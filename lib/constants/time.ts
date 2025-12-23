/**
 * 时间相关常量配置
 */

// 毫秒转换
export const MS = {
  /** 1秒 = 1000毫秒 */
  SECOND: 1000,
  /** 1分钟 = 60000毫秒 */
  MINUTE: 60 * 1000,
  /** 1小时 = 3600000毫秒 */
  HOUR: 60 * 60 * 1000,
  /** 1天 = 86400000毫秒 */
  DAY: 24 * 60 * 60 * 1000,
} as const

// 秒转换
export const SECONDS = {
  /** 1分钟 = 60秒 */
  MINUTE: 60,
  /** 1小时 = 3600秒 */
  HOUR: 60 * 60,
  /** 1天 = 86400秒 */
  DAY: 24 * 60 * 60,
} as const

// 分钟转换
export const MINUTES = {
  /** 1小时 = 60分钟 */
  HOUR: 60,
  /** 1天 = 1440分钟 */
  DAY: 24 * 60,
} as const

// 轮询间隔 (毫秒)
export const POLL_INTERVAL = {
  /** 二维码状态检查间隔 (2秒) */
  QR_CODE_CHECK: 2 * 1000,
  /** 快速轮询间隔 (5秒) */
  FAST: 5 * 1000,
  /** 正常轮询间隔 (30秒) */
  NORMAL: 30 * 1000,
  /** 慢速轮询间隔 (1分钟) */
  SLOW: 60 * 1000,
} as const

// 超时设置 (毫秒)
export const TIMEOUT = {
  /** API 请求超时 (30秒) */
  API_REQUEST: 30 * 1000,
  /** 登录超时 (5分钟) */
  LOGIN: 5 * 60 * 1000,
  /** 二维码有效期 (3分钟) */
  QR_CODE: 3 * 60 * 1000,
} as const

// 缓存过期时间 (秒)
export const CACHE_TTL = {
  /** 短期缓存 (5分钟) */
  SHORT: 5 * 60,
  /** 中期缓存 (30分钟) */
  MEDIUM: 30 * 60,
  /** 长期缓存 (1小时) */
  LONG: 60 * 60,
  /** 持久缓存 (1天) */
  PERSISTENT: 24 * 60 * 60,
} as const
