import { fetch } from 'undici'

const BASE_URL = 'https://ad.xiaohongshu.com'

export interface XhsRequestOptions {
  cookie: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: Record<string, unknown>
  headers?: Record<string, string>
}

export interface XhsResponse<T = unknown> {
  code: number
  msg?: string
  message?: string
  data?: T
  success?: boolean
}

/**
 * 小红书聚光平台 HTTP 请求客户端
 *
 * 使用说明：
 * 1. 所有请求都需要携带有效的 Cookie
 * 2. 请求路径和参数需要根据抓包数据确定
 * 3. 返回数据结构可能需要根据实际响应调整
 */
export async function xhsRequest<T = unknown>(
  options: XhsRequestOptions
): Promise<T> {
  const { cookie, method = 'GET', path, body, headers = {} } = options

  const url = `${BASE_URL}${path}`

  const fetchOptions: RequestInit = {
    method,
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://ad.xiaohongshu.com/',
      Origin: 'https://ad.xiaohongshu.com',
      ...headers,
    },
  }

  if (body) {
    fetchOptions.body = JSON.stringify(body)
  }

  const response = await fetch(url, fetchOptions)

  if (!response.ok) {
    throw new Error(
      `XHS API Error: ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as XhsResponse<T>

  // 检查业务状态码
  if (data.code !== 0 && data.code !== 200 && !data.success) {
    throw new Error(
      `XHS Business Error: ${data.code} - ${data.msg || data.message || '未知错误'}`
    )
  }

  return (data.data || data) as T
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
