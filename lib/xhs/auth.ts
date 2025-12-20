import { getAccountInfo, getUserInfoFull } from './api/account'
import type { ParsedAccountStatus } from './api/account'
import { CookieInvalidError } from './client'

export interface CookieValidation {
  valid: boolean
  userId?: string
  advertiserId?: string
  balance?: number
  nickname?: string
  avatar?: string
  // 新增详细信息
  sellerId?: string
  subAccount?: boolean
  roleType?: number
  permissionsCount?: number
  accountStatus?: ParsedAccountStatus
  hasAbnormalIssues?: boolean
  errorMessage?: string
}

/**
 * 验证 Cookie 有效性
 * 通过调用小红书聚光平台 API 验证
 */
export async function validateCookie(cookie: string): Promise<CookieValidation> {
  // 基本格式检查
  if (!cookie || cookie.length < 10) {
    return { valid: false, errorMessage: 'Cookie 格式无效' }
  }

  const hasRequiredFields = hasRequiredCookieFields(cookie)
  if (!hasRequiredFields) {
    return { valid: false, errorMessage: 'Cookie 缺少必要字段' }
  }

  try {
    // 调用完整用户信息 API
    const userInfoFull = await getUserInfoFull(cookie)

    // 获取余额（需要单独调用）
    let balance = 0
    let advertiserId = ''
    try {
      const info = await getAccountInfo({ cookie })
      balance = info.balance
      advertiserId = info.advertiserId
    } catch {
      // 余额获取失败不影响验证，使用 userInfoFull 中的 advertiserId
      advertiserId = userInfoFull.advertiserId?.toString() || ''
    }

    return {
      valid: true,
      userId: userInfoFull.userId,
      advertiserId,
      balance,
      nickname: userInfoFull.nickname,
      avatar: userInfoFull.avatar,
      sellerId: userInfoFull.sellerId,
      subAccount: userInfoFull.subAccount,
      roleType: userInfoFull.roleType,
      permissionsCount: userInfoFull.permissionsCount,
      accountStatus: userInfoFull.accountStatus,
      hasAbnormalIssues: userInfoFull.hasAbnormalIssues,
    }
  } catch (error) {
    if (error instanceof CookieInvalidError) {
      return { valid: false, errorMessage: 'Cookie 已失效，请重新登录' }
    }

    console.error('Cookie 验证失败:', error)
    return {
      valid: false,
      errorMessage: error instanceof Error ? error.message : '验证失败'
    }
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
