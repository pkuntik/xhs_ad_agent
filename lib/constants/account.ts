/**
 * 账号相关常量配置
 */

// 账号默认配置
export const ACCOUNT_DEFAULTS = {
  /** 默认日预算 (元) */
  DAILY_BUDGET: 5000,
  /** 默认出价金额 (分) */
  DEFAULT_BID_AMOUNT: 30,
} as const

// 账号阈值默认值
export const THRESHOLD_DEFAULTS = {
  /** 最低消耗阈值 (元) */
  MIN_CONSUMPTION: 100,
  /** 最高单个咨询成本 (元) */
  MAX_COST_PER_LEAD: 50,
  /** 最大失败重试次数 */
  MAX_FAIL_RETRIES: 3,
} as const

// 账号状态
export const ACCOUNT_STATUS = {
  /** 活跃 */
  ACTIVE: 'active',
  /** 已停用 */
  INACTIVE: 'inactive',
  /** Cookie 已过期 */
  COOKIE_EXPIRED: 'cookie_expired',
} as const

export type AccountStatus = typeof ACCOUNT_STATUS[keyof typeof ACCOUNT_STATUS]

// 登录方式
export const LOGIN_TYPE = {
  /** Cookie 方式 */
  COOKIE: 'cookie',
  /** 账号密码方式 */
  PASSWORD: 'password',
  /** 扫码方式 */
  QRCODE: 'qrcode',
} as const

export type LoginType = typeof LOGIN_TYPE[keyof typeof LOGIN_TYPE]

// 同步配置
export const SYNC_CONFIG = {
  /** 笔记同步每页数量 */
  NOTES_PAGE_SIZE: 20,
  /** 订单同步每页数量 */
  ORDERS_PAGE_SIZE: 20,
  /** 并发请求数 */
  CONCURRENCY: 3,
} as const
