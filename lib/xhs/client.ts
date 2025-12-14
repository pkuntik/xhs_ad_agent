import { fetch, ProxyAgent, type RequestInit } from 'undici'

const BASE_URL = 'https://ad.xiaohongshu.com'

// Cookie 失效错误码
const COOKIE_INVALID_CODES = [401, 10001, 10002]

// 代理配置
const XHS_PROXY_URL = process.env.XHS_PROXY_URL

// 创建代理 Agent（如果配置了代理）
function getDispatcher() {
  if (!XHS_PROXY_URL) {
    return undefined
  }

  return new ProxyAgent({
    uri: XHS_PROXY_URL,
    connect: {
      rejectUnauthorized: false, // 忽略 SSL 证书验证
    },
  })
}

export interface XhsRequestOptions {
  cookie: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: Record<string, unknown>
  params?: Record<string, string | number>
  headers?: Record<string, string>
}

export interface XhsResponse<T = unknown> {
  code: number
  msg?: string
  message?: string
  data?: T
  success?: boolean
}

export class CookieInvalidError extends Error {
  constructor(message: string = 'Cookie已失效，请重新登录') {
    super(message)
    this.name = 'CookieInvalidError'
  }
}

/**
 * 小红书聚光平台 HTTP 请求客户端
 */
export async function xhsRequest<T = unknown>(
  options: XhsRequestOptions
): Promise<T> {
  const { cookie, method = 'GET', path, body, params, headers = {} } = options

  // 构建 URL（处理 GET 参数）
  let url = `${BASE_URL}${path}`
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value))
    })
    url += `?${searchParams.toString()}`
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Content-Type': 'application/json;charset=UTF-8',
      'Origin': 'https://ad.xiaohongshu.com',
      'Referer': 'https://ad.xiaohongshu.com/',
      ...headers,
    },
  }

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body)
  }

  // 使用代理（如果配置了）
  const dispatcher = getDispatcher()
  const response = await fetch(url, {
    ...fetchOptions,
    dispatcher,
  } as RequestInit)

  if (!response.ok) {
    throw new Error(`XHS API Error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as XhsResponse<T>

  // 检查 Cookie 是否失效
  if (COOKIE_INVALID_CODES.includes(data.code)) {
    throw new CookieInvalidError()
  }

  // 检查业务状态码 (code === 0 表示成功)
  if (data.code !== 0) {
    throw new Error(`XHS Business Error: ${data.code} - ${data.msg || data.message || '未知错误'}`)
  }

  return (data.data ?? data) as T
}

/**
 * 带重试的请求
 */
export async function xhsRequestWithRetry<T = unknown>(
  options: XhsRequestOptions,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await xhsRequest<T>(options)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Cookie 过期不重试
      if (lastError.message.includes('cookie') || lastError.message.includes('登录')) {
        throw lastError
      }

      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)))
      }
    }
  }

  throw lastError
}
