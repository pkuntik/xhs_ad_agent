import { fetch, ProxyAgent, type RequestInit } from 'undici'
import { Xhshow } from '@ikenxuan/xhshow-ts'

const CUSTOMER_BASE_URL = 'https://customer.xiaohongshu.com'
const AD_BASE_URL = 'https://ad.xiaohongshu.com'

// 代理配置
const XHS_PROXY_URL = process.env.XHS_PROXY_URL

// 创建 Agent（支持代理和忽略SSL）
function getDispatcher() {
  if (XHS_PROXY_URL) {
    return new ProxyAgent({
      uri: XHS_PROXY_URL,
      requestTls: {
        rejectUnauthorized: false,
      },
    })
  }
  return undefined
}

export interface LoginResult {
  success: boolean
  error?: string
  cookie?: string
  userId?: string
  advertiserId?: string
}

/**
 * 使用邮箱密码登录小红书聚光平台
 */
export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    const xhshow = new Xhshow()
    const timestamp = Date.now()
    const uri = '/api/cas/customer/web/service-ticket'

    // 生成临时 a1 和 webId 值（模拟浏览器访问时生成的追踪 cookies）
    const tempA1 = generateTempA1()
    const tempWebId = generateWebId()

    // 生成签名
    const xS = xhshow.signXsPost(uri, tempA1, 'xhs-pc-web', {
      service: AD_BASE_URL,
      email,
      pwd: password,
      source: '',
      type: 'emailPwd',
    }, Math.floor(timestamp / 1000))

    const xSCommon = xhshow.signXsc({ a1: tempA1 })

    const requestBody = {
      service: AD_BASE_URL,
      email,
      pwd: password,
      source: '',
      type: 'emailPwd',
    }

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh-TW;q=0.9,zh;q=0.8,en-US;q=0.7,en;q=0.6',
        'Origin': AD_BASE_URL,
        'Referer': `${AD_BASE_URL}/`,
        'X-t': timestamp.toString(),
        'X-s': xS,
        'X-S-Common': xSCommon,
        'x-ratelimit-meta': 'host=ad.xiaohongshu.com',
      },
      body: JSON.stringify(requestBody),
    }

    const dispatcher = getDispatcher()
    const response = await fetch(`${CUSTOMER_BASE_URL}${uri}`, {
      ...fetchOptions,
      dispatcher,
    } as RequestInit)

    // 获取返回的 cookies
    const setCookieHeaders = response.headers.getSetCookie?.() || []

    const data = await response.json() as {
      code: number
      success: boolean
      msg: string
      data?: {
        type: string
        ticket: string
      }
    }

    if (!data.success || data.code !== 0) {
      return {
        success: false,
        error: data.msg || '登录失败',
      }
    }

    if (!data.data?.ticket) {
      return {
        success: false,
        error: '获取登录票据失败',
      }
    }

    // 解析返回的 cookies，并添加生成的追踪 cookies
    const cookies = parseCookiesFromHeaders(setCookieHeaders)
    cookies['a1'] = tempA1
    cookies['webId'] = tempWebId

    // 使用 ticket 换取完整 session，传入 a1 以保持签名一致
    const sessionResult = await exchangeTicketForSession(data.data.ticket, cookies, tempA1)

    if (!sessionResult.success) {
      return sessionResult
    }

    return sessionResult
  } catch (error) {
    console.error('邮箱密码登录失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '登录请求失败',
    }
  }
}

/**
 * 使用 ticket 换取完整 session
 * POST /api/leona/session
 */
async function exchangeTicketForSession(
  ticket: string,
  initialCookies: Record<string, string>,
  a1Value: string
): Promise<LoginResult> {
  try {
    const xhshow = new Xhshow()
    const timestamp = Date.now()
    const uri = '/api/leona/session'

    // 构建完整的 cookie 字符串
    const cookieStr = Object.entries(initialCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')

    const requestBody = {
      ticket,
      clientId: AD_BASE_URL,
    }

    // 生成签名（使用传入的 a1 值保持一致）
    const xS = xhshow.signXsPost(uri, a1Value, 'xhs-pc-web', requestBody, Math.floor(timestamp / 1000))
    const xSCommon = xhshow.signXsc({ a1: a1Value })

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh-TW;q=0.9,zh;q=0.8,en-US;q=0.7,en;q=0.6',
        'Origin': AD_BASE_URL,
        'Referer': `${AD_BASE_URL}/`,
        'X-t': timestamp.toString(),
        'X-s': xS,
        'X-S-Common': xSCommon,
        'Cookie': cookieStr,
      },
      body: JSON.stringify(requestBody),
    }

    const dispatcher = getDispatcher()
    const response = await fetch(`${AD_BASE_URL}${uri}`, {
      ...fetchOptions,
      dispatcher,
    } as RequestInit)

    // 获取返回的新 cookies
    const setCookieHeaders = response.headers.getSetCookie?.() || []
    const newCookies = parseCookiesFromHeaders(setCookieHeaders)

    const data = await response.json() as {
      code: number
      success: boolean
      msg: string
    }

    if (!data.success || data.code !== 0) {
      return {
        success: false,
        error: data.msg || '会话建立失败',
      }
    }

    // 合并所有 cookies
    const allCookies = { ...initialCookies, ...newCookies }

    // 构建最终的 cookie 字符串
    const finalCookieStr = Object.entries(allCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')

    // 从 cookies 中提取用户信息
    const userId = allCookies['x-user-id-ad.xiaohongshu.com'] || ''
    const advertiserId = allCookies['customerClientId'] || ''

    // 检查是否获取到了关键的 session cookie
    if (!allCookies['access-token-ad.xiaohongshu.com'] && !allCookies['ares.beaker.session.id']) {
      return {
        success: false,
        error: '登录会话建立失败，未获取到 session',
      }
    }

    return {
      success: true,
      cookie: finalCookieStr,
      userId,
      advertiserId,
    }
  } catch (error) {
    console.error('换取 session 失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '换取 session 失败',
    }
  }
}

/**
 * 生成临时 a1 值（用于未登录状态的签名）
 */
function generateTempA1(): string {
  const chars = '0123456789abcdef'
  let result = ''
  for (let i = 0; i < 52; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 生成 webId 值（模拟浏览器指纹）
 */
function generateWebId(): string {
  const chars = '0123456789abcdef'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 从 Set-Cookie 头解析 cookies
 */
function parseCookiesFromHeaders(headers: string[]): Record<string, string> {
  const cookies: Record<string, string> = {}

  for (const header of headers) {
    // 解析 cookie 值（只取第一个分号前的部分）
    const match = header.match(/^([^=]+)=([^;]*)/)
    if (match) {
      const [, name, value] = match
      cookies[name.trim()] = value
    }
  }

  return cookies
}

export interface QRCodeLoginResult {
  success: boolean
  error?: string
  qrcode?: string      // 二维码图片 base64
  qrId?: string        // 用于轮询的 ID
}

/**
 * 获取二维码登录信息
 * TODO: 实现二维码登录
 */
export async function getQRCodeLogin(): Promise<QRCodeLoginResult> {
  // TODO: 实现二维码登录
  return {
    success: false,
    error: '二维码登录暂未实现',
  }
}

/**
 * 检查二维码扫描状态
 * TODO: 实现二维码状态检查
 */
export async function checkQRCodeStatus(qrId: string): Promise<LoginResult> {
  // TODO: 实现二维码状态检查
  return {
    success: false,
    error: '二维码登录暂未实现',
  }
}
