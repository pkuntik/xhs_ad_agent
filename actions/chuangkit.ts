'use server'

import md5 from 'crypto-js/md5'

interface SignParams {
  userFlag?: string
  mode?: 'create' | 'edit'
  templateId?: string
  designId?: string
  uploadImgUrl?: string
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
    const { userFlag = 'anonymous', mode = 'create', templateId, designId, uploadImgUrl } = params

    const appId = process.env.CHUANGKIT_APP_ID
    const appSecret = process.env.CHUANGKIT_APP_SECRET
    const settingCode = process.env.CHUANGKIT_SETTING_CODE

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
      mode,
      device_type: 1, // web端
      version: '2.0',
      sign,
      coop_material_limit: 2,
      coop_font_limit: 2,
      charging_template_limit: 2,
      z_index: '100',
    }

    if (settingCode) {
      editorParams.setting_code = settingCode
    }

    if (mode === 'create') {
      editorParams.kind_id = 502
    }

    if (templateId && !designId) {
      editorParams.template_id = templateId
    }

    if (designId) {
      editorParams.design_id = designId
    }

    if (uploadImgUrl) {
      editorParams.upload_img_url = uploadImgUrl
    }

    return { success: true, params: editorParams }
  } catch (error) {
    console.error('Chuangkit Sign Error:', error)
    return { success: false, error: error instanceof Error ? error.message : '签名生成失败' }
  }
}
