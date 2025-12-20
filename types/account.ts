import { ObjectId } from 'mongodb'

// 账号状态
// pending: 待完善（仅有作者信息，无 cookie）
// active: 正常
// inactive: 已停用
// suspended: 已暂停
// cookie_expired: Cookie 已过期
export type AccountStatus = 'pending' | 'active' | 'inactive' | 'suspended' | 'cookie_expired'

// 登录方式
export type LoginType = 'cookie' | 'password' | 'qrcode'

// 账号阈值配置
export interface AccountThresholds {
  minConsumption: number      // 开始检查效果的最低消耗 (默认 100)
  maxCostPerLead: number      // 单次咨询成本上限
  maxFailRetries: number      // 最大失败重试次数
}

// 账号状态详情（来自 API）
export interface AccountStatusDetail {
  isSubAccountFrozen: boolean    // 子账号是否冻结
  freezeReasons: string[]        // 冻结原因列表
  abnormalReasons: string[]      // 异常原因列表
  adStatus: number               // 广告状态 (1=正常)
  professionalState: number      // 专业状态
  subjectState: number           // 主体状态 (200=正常)
  promotionQualityState: number  // 推广资质状态 (200=正常)
  certificationState: number     // 认证状态 (2=已认证)
}

// 小红书账号
export interface XhsAccount {
  _id: ObjectId
  // 关联系统用户
  userId?: ObjectId               // 系统用户 ID (关联 users 集合)

  // 基础信息
  name: string                    // 账号名称/备注
  visitorUserId: string           // 小红书用户 ID (原 userId)
  cookie?: string                 // 登录 Cookie (pending 状态时为空)
  nickname?: string               // 小红书昵称
  avatar?: string                 // 头像 URL

  // 登录信息
  loginType?: LoginType           // 登录方式
  loginEmail?: string             // 登录邮箱（账号密码登录时保存）
  loginPassword?: string          // 登录密码（账号密码登录时保存）

  // 聚光平台信息（pending 状态时可能为空）
  advertiserId?: string           // 广告主 ID
  sellerId?: string               // 卖家 ID
  balance?: number                // 账户余额

  // 账号详情
  subAccount?: boolean            // 是否子账号
  roleType?: number               // 角色类型
  permissionsCount?: number       // 权限数量
  hasChipsPermission?: boolean    // 是否有薯条权限
  accountStatusDetail?: AccountStatusDetail  // 账号状态详情
  hasAbnormalIssues?: boolean     // 是否有异常问题

  // 托管配置（pending 状态时使用默认值）
  autoManaged?: boolean           // 是否开启自动托管
  dailyBudget?: number            // 每日预算上限
  defaultBidAmount?: number       // 默认出价 (私信咨询量)

  // 效果阈值配置
  thresholds?: AccountThresholds

  // 状态
  status: AccountStatus
  isPinned?: boolean              // 是否置顶
  lastSyncAt?: Date               // 最后同步时间
  cookieExpireAt?: Date           // Cookie 过期时间

  // 审计字段
  createdAt: Date
  updatedAt: Date
}

// 创建账号的输入（Cookie 方式）
export interface CreateAccountInput {
  name?: string              // 可选，不填则使用从 Cookie 获取的昵称
  cookie: string
  dailyBudget?: number
  defaultBidAmount?: number
  thresholds?: Partial<AccountThresholds>
}

// 创建账号的输入（账号密码方式）
export interface CreateAccountByPasswordInput {
  email: string
  password: string
  dailyBudget?: number
  defaultBidAmount?: number
  thresholds?: Partial<AccountThresholds>
}

// 账号列表项（不含敏感信息，用于数据库查询）
export type AccountListItemRaw = Omit<XhsAccount, 'cookie'>

// 账号列表项（序列化后，用于客户端组件）
export interface AccountListItem extends Omit<AccountListItemRaw, '_id' | 'userId'> {
  _id: string
  userId?: string
}
