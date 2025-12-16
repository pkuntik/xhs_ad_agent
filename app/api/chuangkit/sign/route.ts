import { NextRequest } from 'next/server'
import md5 from 'crypto-js/md5'

export const runtime = 'nodejs'

interface SignRequest {
  userFlag?: string
  mode?: 'create' | 'edit'
  templateId?: string
  designId?: string
  uploadImgUrl?: string  // 要编辑的图片 URL
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

export async function POST(req: NextRequest) {
  try {
    const { userFlag = 'anonymous', mode = 'create', templateId, designId, uploadImgUrl }: SignRequest = await req.json()

    const appId = process.env.CHUANGKIT_APP_ID
    const appSecret = process.env.CHUANGKIT_APP_SECRET
    const settingCode = process.env.CHUANGKIT_SETTING_CODE

    if (!appId || !appSecret) {
      return Response.json(
        { error: '创客贴配置未设置，请配置 CHUANGKIT_APP_ID 和 CHUANGKIT_APP_SECRET' },
        { status: 500 }
      )
    }

    // 5分钟后过期
    const expireTime = Date.now() + 300000
    const sign = buildSign(appId, expireTime, userFlag, appSecret)

    // 构建编辑器参数
    const editorParams: Record<string, unknown> = {
      app_id: appId,
      expire_time: expireTime,
      user_flag: userFlag,
      mode,
      device_type: 1, // web端
      version: '2.0',
      sign,
      coop_material_limit: 2, // 允许使用全部素材
      coop_font_limit: 2, // 允许使用全部字体
      charging_template_limit: 2, // 允许使用全部模板
      z_index: '100',
    }

    if (settingCode) {
      editorParams.setting_code = settingCode
    }

    if (mode === 'create') {
      editorParams.kind_id = 502 // 默认场景ID
    }

    if (templateId && !designId) {
      editorParams.template_id = templateId
    }

    if (designId) {
      editorParams.design_id = designId
    }

    // 如果有图片 URL，设置上传图片参数
    if (uploadImgUrl) {
      editorParams.upload_img_url = uploadImgUrl
    }

    return Response.json({
      success: true,
      params: editorParams,
    })
  } catch (error: unknown) {
    console.error('Chuangkit Sign Error:', error)
    const errorMessage = error instanceof Error ? error.message : '签名生成失败'
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
