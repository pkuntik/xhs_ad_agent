import { ObjectId } from 'mongodb'

// 账号状态
export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'cookie_expired'

// 账号阈值配置
export interface AccountThresholds {
  minConsumption: number      // 开始检查效果的最低消耗 (默认 100)
  maxCostPerLead: number      // 单次咨询成本上限
  maxFailRetries: number      // 最大失败重试次数
}

// 小红书账号
export interface XhsAccount {
  _id: ObjectId
  // 关联系统用户
  userId?: ObjectId               // 系统用户 ID (关联 users 集合)

  // 基础信息
  name: string                    // 账号名称/备注
  visitorUserId: string           // 小红书用户 ID (原 userId)
  cookie: string                  // 登录 Cookie (加密存储)

  // 聚光平台信息
  advertiserId: string            // 广告主 ID
  balance: number                 // 账户余额

  // 托管配置
  autoManaged: boolean            // 是否开启自动托管
  dailyBudget: number             // 每日预算上限
  defaultBidAmount: number        // 默认出价 (私信咨询量)

  // 效果阈值配置
  thresholds: AccountThresholds

  // 状态
  status: AccountStatus
  lastSyncAt: Date                // 最后同步时间
  cookieExpireAt?: Date           // Cookie 过期时间

  // 审计字段
  createdAt: Date
  updatedAt: Date
}

// 创建账号的输入
export interface CreateAccountInput {
  name?: string              // 可选，不填则使用从 Cookie 获取的昵称
  cookie: string
  dailyBudget?: number
  defaultBidAmount?: number
  thresholds?: Partial<AccountThresholds>
}

// 账号列表项（不含敏感信息）
export type AccountListItem = Omit<XhsAccount, 'cookie'>
