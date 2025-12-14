import { xhsRequest } from './client'

export interface CookieValidation {
  valid: boolean
  userId?: string
  advertiserId?: string
  balance?: number
  nickname?: string
  expireAt?: Date
}

/**
 * 验证 Cookie 有效性
 *
 * TODO: 根据抓包数据实现具体逻辑
 * 预期调用接口获取账号信息，验证 Cookie 是否有效
 */
export async function validateCookie(cookie: string): Promise<CookieValidation> {
  try {
    // TODO: 替换为实际的验证接口
    // 预期接口：获取当前登录用户信息
    // const data = await xhsRequest({
    //   cookie,
    //   path: '/api/gw/advertiser/account/info',
    // })
    //
    // return {
    //   valid: true,
    //   userId: data.userId,
    //   advertiserId: data.advertiserId,
    //   balance: data.balance,
    //   nickname: data.nickname,
    // }

    // 临时实现：仅检查 Cookie 格式
    if (!cookie || cookie.length < 10) {
      return { valid: false }
    }

    const hasRequiredFields = hasRequiredCookieFields(cookie)
    if (!hasRequiredFields) {
      return { valid: false }
    }

    // TODO: 实际验证需要调用接口
    return {
      valid: true,
      userId: 'pending',
      advertiserId: 'pending',
      balance: 0,
    }
  } catch (error) {
    console.error('Cookie 验证失败:', error)
    return { valid: false }
  }
}

/**
 * 从 Cookie 中解析关键参数
 */
export function parseCookie(cookie: string): Record<string, string> {
  const cookies: Record<string, string> = {}

  cookie.split(';').forEach((item) => {
    const [key, value] = item.trim().split('=')
    if (key && value) {
      cookies[key] = value
    }
  })

  return cookies
}

/**
 * 检查 Cookie 是否包含必要字段
 *
 * TODO: 根据抓包确定必要的 Cookie 字段
 */
export function hasRequiredCookieFields(cookie: string): boolean {
  const parsed = parseCookie(cookie)

  // TODO: 根据实际情况调整必要字段
  // 常见的小红书 Cookie 字段可能包括：a1, webId, web_session, xsecappid 等
  const requiredFields = ['a1', 'webId']

  return requiredFields.some((field) => parsed[field])
}

/**
 * 刷新 Cookie（如果支持）
 *
 * TODO: 根据抓包数据实现，如果聚光平台支持刷新 token
 */
export async function refreshCookie(cookie: string): Promise<string | null> {
  // TODO: 实现 Cookie 刷新逻辑
  return null
}
