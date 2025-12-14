import { xhsRequest, CookieInvalidError } from '../client'

// ============ 类型定义 ============

export interface UserInfo {
  userId: string
  nickname: string
  avatar?: string
}

export interface Advertiser {
  advertiserId: string
  advertiserName: string
  status: number
}

export interface AccountBalance {
  balance: number        // 余额（分）
  cashBalance?: number   // 现金余额
  giftBalance?: number   // 赠送余额
}

export interface AccountInfo {
  userId: string
  advertiserId: string
  nickname: string
  avatar?: string
  balance: number        // 余额（元）
  todaySpent: number
  cookieValid: boolean
}

// ============ API 接口 ============

/**
 * 获取当前用户信息
 * GET /api/leona/user/info
 */
export async function getUserInfo(cookie: string): Promise<UserInfo> {
  return xhsRequest<UserInfo>({
    cookie,
    method: 'GET',
    path: '/api/leona/user/info',
  })
}

/**
 * 获取广告主列表
 * GET /api/leona/advertiser/list
 */
export async function getAdvertiserList(cookie: string): Promise<Advertiser[]> {
  const data = await xhsRequest<{ list?: Advertiser[] } | Advertiser[]>({
    cookie,
    method: 'GET',
    path: '/api/leona/advertiser/list',
  })
  // 兼容两种返回格式
  return Array.isArray(data) ? data : (data.list || [])
}

/**
 * 获取账户余额
 * GET /api/leona/account/balance
 */
export async function getAccountBalanceApi(cookie: string): Promise<AccountBalance> {
  return xhsRequest<AccountBalance>({
    cookie,
    method: 'GET',
    path: '/api/leona/account/balance',
  })
}

/**
 * 获取完整账号信息（组合接口）
 */
export async function getAccountInfo(params: { cookie: string }): Promise<AccountInfo> {
  const { cookie } = params

  try {
    // 并行请求用户信息、广告主列表、余额
    const [userInfo, advertisers, balanceInfo] = await Promise.all([
      getUserInfo(cookie),
      getAdvertiserList(cookie),
      getAccountBalanceApi(cookie).catch(() => ({ balance: 0 })),
    ])

    const advertiser = advertisers[0] // 取第一个广告主

    return {
      userId: userInfo.userId,
      advertiserId: advertiser?.advertiserId || '',
      nickname: userInfo.nickname,
      avatar: userInfo.avatar,
      balance: (balanceInfo.balance || 0) / 100, // 分转元
      todaySpent: 0, // TODO: 从报表接口获取
      cookieValid: true,
    }
  } catch (error) {
    if (error instanceof CookieInvalidError) {
      throw error
    }
    throw new Error(`获取账号信息失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 获取广告主 ID
 */
export async function getAdvertiserId(params: { cookie: string }): Promise<string> {
  const advertisers = await getAdvertiserList(params.cookie)
  return advertisers[0]?.advertiserId || ''
}

/**
 * 获取账户余额（元）
 */
export async function getAccountBalance(params: {
  cookie: string
  advertiserId: string
}): Promise<number> {
  const balance = await getAccountBalanceApi(params.cookie)
  return (balance.balance || 0) / 100
}
