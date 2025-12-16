'use server'

import md5 from 'crypto-js/md5'
import { nanoid } from 'nanoid'
import { uploadToOSS } from '@/lib/oss/client'

interface SignParams {
  userFlag?: string
  templateId?: string
  designId?: string
  uploadImgUrl?: string
  /** 上传图片的宽度 */
  uploadImgWidth?: number
  /** 上传图片的高度 */
  uploadImgHeight?: number
}

/**
 * 生成创客贴 2.0 版本签名
 */
function buildSign(appId: string, expireTime: number, userFlag: string, appSecret: string): string {
  const signParams = {
    app_id: appId,
    app_secret: appSecret,
    expire_time: expireTime,
    user_flag: userFlag,
  }

  // 按 ASCII 码排序并拼接
  const sortedKeys = Object.keys(signParams).sort()
  const stringA = sortedKeys
    .map(key => `${key}=${(signParams as Record<string, unknown>)[key]}`)
    .join('&')

  // MD5 加密并转大写
  return md5(stringA).toString().toUpperCase()
}

/**
 * 生成创客贴编辑器签名参数
 */
export async function signChuangkitRequest(
  params: SignParams = {}
): Promise<{ success: boolean; params?: Record<string, unknown>; error?: string }> {
  try {
    const { userFlag = 'anonymous', templateId, designId, uploadImgUrl, uploadImgWidth, uploadImgHeight } = params

    const appId = process.env.CHUANGKIT_APP_ID
    const appSecret = process.env.CHUANGKIT_APP_SECRET
    const settingCode = process.env.CHUANGKIT_SETTING_CODE
    const editorSettingCode = process.env.CHUANGKIT_EDITOR_SETTING_CODE

    if (!appId || !appSecret) {
      return { success: false, error: '创客贴配置未设置' }
    }

    // 5分钟后过期
    const expireTime = Date.now() + 300000
    const sign = buildSign(appId, expireTime, userFlag, appSecret)

    // 构建编辑器参数
    const editorParams: Record<string, unknown> = {
      app_id: appId,
      expire_time: expireTime,
      user_flag: userFlag,
      device_type: 1, // web端
      version: '2.0',
      sign,
      coop_material_limit: 2,
      coop_font_limit: 2,
      charging_template_limit: 2,
      z_index: '100',
    }

    // 优先使用编辑器配置代码，否则使用通用配置代码
    if (editorSettingCode) {
      editorParams.setting_code = editorSettingCode
    } else if (settingCode) {
      editorParams.setting_code = settingCode
    }

    // 如果有 designId，直接编辑已有设计稿（SDK 会自动加载）
    if (designId) {
      editorParams.design_id = designId
      console.log('Chuangkit: Edit mode - loading design:', designId)
      // 编辑模式下不需要设置 kind_id、width、height 等，设计稿已包含这些信息
    } else {
      console.log('Chuangkit: Create mode')
      // 创建模式设置画布
      if (uploadImgWidth && uploadImgWidth > 0 && uploadImgHeight && uploadImgHeight > 0) {
        editorParams.kind_id = 127 // 自定义尺寸场景 (px)
        editorParams.width = uploadImgWidth
        editorParams.height = uploadImgHeight
        editorParams.unit = 'px'
      } else {
        editorParams.kind_id = 502 // 默认小红书封面场景
      }

      if (templateId) {
        editorParams.template_id = templateId
      }

      if (uploadImgUrl) {
        editorParams.upload_img_url = uploadImgUrl
        // 根据文档，使用 upload_img_url 时需要同时设置以下参数
        if (uploadImgWidth && uploadImgWidth > 0) {
          editorParams.upload_img_width = uploadImgWidth
          editorParams.upload_img_top = 0 // 图片放置在画布顶部
          editorParams.upload_img_left = 0 // 图片放置在画布左侧
        }
      }
    }

    console.log('Chuangkit editorParams:', JSON.stringify(editorParams, null, 2))
    return { success: true, params: editorParams }
  } catch (error) {
    console.error('Chuangkit Sign Error:', error)
    return { success: false, error: error instanceof Error ? error.message : '签名生成失败' }
  }
}

/**
 * 将创客贴返回的图片 URL 下载并上传到我们的 OSS
 * @param imageUrls 创客贴返回的图片 URL 数组
 * @returns 上传到 OSS 后的 URL 数组
 */
export async function uploadChuangkitImagesToOSS(
  imageUrls: string[]
): Promise<{ success: boolean; urls?: string[]; error?: string }> {
  try {
    const uploadedUrls: string[] = []

    for (let url of imageUrls) {
      // 处理协议相对 URL（以 // 开头）
      if (url.startsWith('//')) {
        url = 'https:' + url
      }

      // 下载图片
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`下载图片失败: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // 获取文件扩展名
      const contentType = response.headers.get('content-type') || 'image/png'
      const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png'

      // 生成唯一文件名
      const fileName = `chuangkit/${Date.now()}-${nanoid(8)}.${ext}`

      // 上传到 OSS
      const ossUrl = await uploadToOSS(fileName, buffer, contentType)
      uploadedUrls.push(ossUrl)
    }

    return { success: true, urls: uploadedUrls }
  } catch (error) {
    console.error('Upload Chuangkit images to OSS error:', error)
    return { success: false, error: error instanceof Error ? error.message : '上传图片失败' }
  }
}
