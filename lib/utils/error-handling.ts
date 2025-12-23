/**
 * 统一错误处理工具
 */

// 错误代码常量
export const ERROR_CODES = {
  // 认证相关
  AUTH_NOT_LOGGED_IN: 'AUTH_NOT_LOGGED_IN',
  AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
  AUTH_COOKIE_EXPIRED: 'AUTH_COOKIE_EXPIRED',
  AUTH_COOKIE_INVALID: 'AUTH_COOKIE_INVALID',

  // 账号相关
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_DUPLICATE: 'ACCOUNT_DUPLICATE',
  ACCOUNT_QUOTA_EXCEEDED: 'ACCOUNT_QUOTA_EXCEEDED',
  ACCOUNT_NO_COOKIE: 'ACCOUNT_NO_COOKIE',

  // 投放相关
  CAMPAIGN_NOT_FOUND: 'CAMPAIGN_NOT_FOUND',
  CAMPAIGN_CREATE_FAILED: 'CAMPAIGN_CREATE_FAILED',
  CAMPAIGN_PAUSE_FAILED: 'CAMPAIGN_PAUSE_FAILED',

  // 作品相关
  WORK_NOT_FOUND: 'WORK_NOT_FOUND',
  NOTE_NOT_FOUND: 'NOTE_NOT_FOUND',

  // API 相关
  API_REQUEST_FAILED: 'API_REQUEST_FAILED',
  API_RESPONSE_INVALID: 'API_RESPONSE_INVALID',

  // 通用错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]

// 错误消息映射
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.AUTH_NOT_LOGGED_IN]: '请先登录',
  [ERROR_CODES.AUTH_USER_NOT_FOUND]: '用户不存在',
  [ERROR_CODES.AUTH_COOKIE_EXPIRED]: 'Cookie 已过期，请重新登录',
  [ERROR_CODES.AUTH_COOKIE_INVALID]: 'Cookie 无效或已过期',

  [ERROR_CODES.ACCOUNT_NOT_FOUND]: '账号不存在',
  [ERROR_CODES.ACCOUNT_DUPLICATE]: '该账号已存在',
  [ERROR_CODES.ACCOUNT_QUOTA_EXCEEDED]: '账号数量已达上限',
  [ERROR_CODES.ACCOUNT_NO_COOKIE]: '账号未配置登录凭证',

  [ERROR_CODES.CAMPAIGN_NOT_FOUND]: '投放计划不存在',
  [ERROR_CODES.CAMPAIGN_CREATE_FAILED]: '创建投放计划失败',
  [ERROR_CODES.CAMPAIGN_PAUSE_FAILED]: '暂停投放计划失败',

  [ERROR_CODES.WORK_NOT_FOUND]: '作品不存在',
  [ERROR_CODES.NOTE_NOT_FOUND]: '笔记不存在',

  [ERROR_CODES.API_REQUEST_FAILED]: 'API 请求失败',
  [ERROR_CODES.API_RESPONSE_INVALID]: 'API 响应格式无效',

  [ERROR_CODES.VALIDATION_ERROR]: '参数验证失败',
  [ERROR_CODES.DATABASE_ERROR]: '数据库操作失败',
  [ERROR_CODES.UNKNOWN_ERROR]: '未知错误',
}

/**
 * 应用错误类 - 用于业务逻辑错误
 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly details?: unknown

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message || ERROR_MESSAGES[code] || '未知错误')
    this.name = 'AppError'
    this.code = code
    this.details = details

    // 确保正确的原型链
    Object.setPrototypeOf(this, AppError.prototype)
  }

  /**
   * 转换为可序列化的对象
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    }
  }
}

/**
 * Server Action 返回结果类型
 */
export interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  code?: ErrorCode
  data?: T
}

/**
 * 处理 Server Action 错误
 * 统一将各种错误转换为标准的返回格式
 */
export function handleActionError(error: unknown, context?: string): ActionResult {
  // 记录错误日志
  logError(error, context)

  // AppError - 业务错误，返回友好消息
  if (error instanceof AppError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
    }
  }

  // 标准 Error
  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
      code: ERROR_CODES.UNKNOWN_ERROR,
    }
  }

  // 其他未知错误
  return {
    success: false,
    error: '未知错误',
    code: ERROR_CODES.UNKNOWN_ERROR,
  }
}

/**
 * 记录错误日志
 */
export function logError(error: unknown, context?: string): void {
  const timestamp = new Date().toISOString()
  const prefix = context ? `[${context}]` : ''

  if (error instanceof AppError) {
    console.error(`${timestamp} ${prefix} AppError [${error.code}]:`, error.message, error.details || '')
  } else if (error instanceof Error) {
    console.error(`${timestamp} ${prefix} Error:`, error.message, error.stack)
  } else {
    console.error(`${timestamp} ${prefix} Unknown error:`, error)
  }
}

/**
 * 创建成功的 Action 结果
 */
export function successResult<T>(data?: T): ActionResult<T> {
  return {
    success: true,
    data,
  }
}

/**
 * 创建失败的 Action 结果
 */
export function errorResult(error: string, code?: ErrorCode): ActionResult {
  return {
    success: false,
    error,
    code: code || ERROR_CODES.UNKNOWN_ERROR,
  }
}

/**
 * 包装异步函数，自动处理错误
 */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<ActionResult<R>>,
  context?: string
): (...args: T) => Promise<ActionResult<R>> {
  return async (...args: T): Promise<ActionResult<R>> => {
    try {
      return await fn(...args)
    } catch (error) {
      return handleActionError(error, context) as ActionResult<R>
    }
  }
}

/**
 * 断言条件，如果不满足则抛出 AppError
 */
export function assertCondition(
  condition: boolean,
  code: ErrorCode,
  message?: string
): asserts condition {
  if (!condition) {
    throw new AppError(code, message)
  }
}

/**
 * 断言值存在，如果为 null 或 undefined 则抛出 AppError
 */
export function assertExists<T>(
  value: T | null | undefined,
  code: ErrorCode,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new AppError(code, message)
  }
}
