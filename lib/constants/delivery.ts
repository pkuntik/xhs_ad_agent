/**
 * 投放相关常量配置
 */

// 预算配置 (单位: 元)
export const BUDGET = {
  /** 默认投放预算 */
  DEFAULT: 2000,
  /** 托管投放单次预算 */
  MANAGED_DEFAULT: 75,
} as const

// 出价配置 (单位: 分)
export const BID = {
  /** 默认出价金额 */
  DEFAULT_AMOUNT: 30,
} as const

// 检查间隔 (单位: 分钟)
export const CHECK_INTERVAL = {
  /** 短间隔 - 用于未达阈值或阶段1无咨询时 */
  SHORT: 30,
  /** 长间隔 - 用于有效果时继续监控 */
  LONG: 60,
  /** 快速检查 - 用于紧急情况 */
  QUICK: 5,
} as const

// 消耗阈值配置 (单位: 元)
export const THRESHOLD = {
  /** 最低消耗阈值 - 达到后才开始判断效果 */
  MIN_CONSUMPTION: 100,
  /** 最高单个咨询成本 */
  MAX_COST_PER_LEAD: 50,
  /** 阶段1检查阈值 */
  CHECK_STAGE_1: 60,
  /** 阶段2检查阈值 */
  CHECK_STAGE_2: 120,
} as const

// 托管投放配置
export const MANAGED_DELIVERY = {
  /** 默认投放时长 (秒) - 6小时 */
  DEFAULT_DURATION: 21600,
  /** 最小投放次数 */
  MIN_ATTEMPTS: 3,
  /** 最低成功率 (百分比) */
  MIN_SUCCESS_RATE: 30,
  /** 最大重试次数 */
  MAX_RETRIES: 3,
} as const

// 时间转换常量
export const TIME = {
  /** 分钟转毫秒 */
  MINUTE_MS: 60 * 1000,
  /** 秒转毫秒 */
  SECOND_MS: 1000,
} as const
