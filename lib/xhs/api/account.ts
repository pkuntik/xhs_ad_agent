import { xhsRequest, CookieInvalidError } from '../client'

// ============ 类型定义 ============

// 账号状态详情（userAccountStatus 对象）
interface AccountStatusDetail {
  // 子账号冻结状态 - JSON 字符串 {"isFreeze":true,"freezeReasonList":[...]}
  agentSubAccountState?: string
  // 账号异常状态 - JSON 字符串 {"accountAbnormalReason":[]}
  accountAbnormalStatus?: string
  // 广告冻结状态 - JSON 字符串 {"accountAdStatus":1}
  accountAdFreeze?: string
  // 专业状态 - JSON 字符串 {"state":1}
  professionalState?: string
  // 主体状态 (200 = 正常)
  subjectState?: number
  // 推广资质状态 (200 = 正常)
  promotionQualityState?: number
  // 推广资质提交状态 (200 = 已提交)
  promotionQualitySubmitState?: number
  // 广告主认证状态 (2 = 已认证)
  advertiserCertificationState?: number
  // 是否需要展示创意笔记
  needShowRecNote?: boolean
  // 是否首次充值限制
  firstRechargeLimit?: boolean
  // 品牌惩罚账号 - JSON 字符串
  isBrandPunishAccount?: string
  // 是否 Level0 - JSON 字符串
  level0?: string
}

// user/info 接口的原始返回格式
interface UserInfoRaw {
  userId: string
  loginAccount: string
  nickName: string  // 注意：API 返回的是 nickName
  avatar?: string
  sellerId?: string
  vSellerId?: string           // 虚拟店铺 ID
  advertiserId?: number        // 广告主 ID (数字格式)
  bUserId?: string             // B 端用户 ID
  imUserId?: string            // IM 用户 ID
  fromArk?: boolean
  superAdminFlag?: boolean
  subAccount?: boolean         // 是否子账号
  permissions?: string[]       // 权限列表
  roleType?: number            // 角色类型
  backRoleType?: number        // 后台角色类型
  sellerRelationState?: number // 卖家关系状态
  strongRelation?: boolean     // 是否强关系
  shadowConfirm?: boolean      // 影子确认
  jumpFromOtherUser?: boolean  // 是否从其他用户跳转
  shieldCreditFlag?: boolean   // 信用屏蔽标记
  level0?: boolean             // 是否 Level0
  isBrandPunishAccount?: boolean // 是否品牌惩罚账号
  userAccountStatus?: AccountStatusDetail
}

// 解析后的账号状态
export interface ParsedAccountStatus {
  isSubAccountFrozen: boolean    // 子账号是否冻结
  freezeReasons: string[]        // 冻结原因列表
  abnormalReasons: string[]      // 异常原因列表
  adStatus: number               // 广告状态 (1=正常, 其他=异常)
  professionalState: number      // 专业状态
  subjectState: number           // 主体状态 (200=正常)
  promotionQualityState: number  // 推广资质状态 (200=正常)
  certificationState: number     // 认证状态 (2=已认证)
}

export interface UserInfo {
  userId: string
  nickname: string
  avatar?: string
}

// 完整用户信息（包含更多详情）
export interface UserInfoFull extends UserInfo {
  loginAccount: string           // 登录账号 ID
  sellerId?: string              // 卖家 ID
  advertiserId?: number          // 广告主 ID
  subAccount: boolean            // 是否子账号
  roleType: number               // 角色类型
  permissions: string[]          // 权限列表
  permissionsCount: number       // 权限数量
  accountStatus: ParsedAccountStatus  // 解析后的账号状态
  hasAbnormalIssues: boolean     // 是否有异常问题
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
 * 解析账号状态详情
 */
function parseAccountStatus(status?: AccountStatusDetail): ParsedAccountStatus {
  const result: ParsedAccountStatus = {
    isSubAccountFrozen: false,
    freezeReasons: [],
    abnormalReasons: [],
    adStatus: 1,
    professionalState: 0,
    subjectState: 0,
    promotionQualityState: 0,
    certificationState: 0,
  }

  if (!status) return result

  // 解析子账号冻结状态
  if (status.agentSubAccountState) {
    try {
      const parsed = JSON.parse(status.agentSubAccountState)
      result.isSubAccountFrozen = parsed.isFreeze === true
      result.freezeReasons = parsed.freezeReasonList || []
    } catch {}
  }

  // 解析账号异常状态
  if (status.accountAbnormalStatus) {
    try {
      const parsed = JSON.parse(status.accountAbnormalStatus)
      result.abnormalReasons = parsed.accountAbnormalReason || []
    } catch {}
  }

  // 解析广告冻结状态
  if (status.accountAdFreeze) {
    try {
      const parsed = JSON.parse(status.accountAdFreeze)
      result.adStatus = parsed.accountAdStatus ?? 1
    } catch {}
  }

  // 解析专业状态
  if (status.professionalState) {
    try {
      const parsed = JSON.parse(status.professionalState)
      result.professionalState = parsed.state ?? 0
    } catch {}
  }

  result.subjectState = status.subjectState ?? 0
  result.promotionQualityState = status.promotionQualityState ?? 0
  result.certificationState = status.advertiserCertificationState ?? 0

  return result
}

/**
 * 获取当前用户信息
 * GET /api/leona/user/info
 */
export async function getUserInfo(cookie: string): Promise<UserInfo> {
  const raw = await xhsRequest<UserInfoRaw>({
    cookie,
    method: 'GET',
    path: '/api/leona/user/info',
  })

  return {
    userId: raw.userId,
    nickname: raw.nickName,  // 转换字段名
    avatar: raw.avatar,
  }
}

/**
 * 获取完整用户信息（包含更多详情）
 * GET /api/leona/user/info
 */
export async function getUserInfoFull(cookie: string): Promise<UserInfoFull> {
  const raw = await xhsRequest<UserInfoRaw>({
    cookie,
    method: 'GET',
    path: '/api/leona/user/info',
  })

  const accountStatus = parseAccountStatus(raw.userAccountStatus)
  const hasAbnormalIssues =
    accountStatus.isSubAccountFrozen ||
    accountStatus.abnormalReasons.length > 0 ||
    accountStatus.adStatus !== 1 ||
    accountStatus.subjectState !== 200 ||
    accountStatus.promotionQualityState !== 200

  return {
    userId: raw.userId,
    loginAccount: raw.loginAccount,
    nickname: raw.nickName,
    avatar: raw.avatar,
    sellerId: raw.sellerId,
    advertiserId: raw.advertiserId,
    subAccount: raw.subAccount ?? false,
    roleType: raw.roleType ?? 0,
    permissions: raw.permissions ?? [],
    permissionsCount: raw.permissions?.length ?? 0,
    accountStatus,
    hasAbnormalIssues,
  }
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
 * 注意：对于未上传营业执照的账号，advertiser/list 和 account/balance 可能返回 404/500
 */
export async function getAccountInfo(params: { cookie: string }): Promise<AccountInfo> {
  const { cookie } = params

  try {
    // 先获取用户信息（必须成功）
    const userInfo = await getUserInfo(cookie)

    // 广告主列表和余额可以失败（未认证账号会返回404/500）
    const [advertisers, balanceInfo] = await Promise.all([
      getAdvertiserList(cookie).catch(() => [] as Advertiser[]),
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
