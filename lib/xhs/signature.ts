import crypto from 'crypto'

const APP_KEY = process.env.XHS_APP_KEY || 'red.gLvsVoksierVz0uF'
const APP_SECRET = process.env.XHS_APP_SECRET || 'f13a2266d1e2c32a553cb7a42ea63c48'

// 缓存 access_token
let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * 生成小红书 API 签名
 * 格式：appKey=xxx&nonce=xxx&timeStamp=xxx + secret
 * 注意：timeStamp 是驼峰式
 */
export function generateSignature(nonce: string, timestamp: string, secret: string): string {
  // 固定格式拼接（不是动态排序，按照官方示例格式）
  const paramStr = `appKey=${APP_KEY}&nonce=${nonce}&timeStamp=${timestamp}${secret}`

  // 计算 SHA256
  return crypto.createHash('sha256').update(paramStr).digest('hex')
}

/**
 * 获取 access_token（第一步签名）
 */
async function getAccessToken(nonce: string, timestamp: string): Promise<string | null> {
  // 检查缓存
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }

  const signature = generateSignature(nonce, timestamp, APP_SECRET)

  try {
    const response = await fetch('https://edith.xiaohongshu.com/api/sns/v1/ext/access/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_key: APP_KEY,
        nonce,
        timestamp: parseInt(timestamp, 10),
        signature,
      }),
    })

    const result = await response.json()

    if (result.data?.access_token) {
      // 缓存 token（假设有效期 1 小时，提前 5 分钟过期）
      cachedToken = {
        token: result.data.access_token,
        expiresAt: Date.now() + 55 * 60 * 1000,
      }
      return result.data.access_token
    }

    console.error('获取 access_token 失败:', result)
    return null
  } catch (error) {
    console.error('获取 access_token 请求失败:', error)
    return null
  }
}

/**
 * 生成验证配置（用于 H5 页面调用 xhs.share）
 * 需要两次签名：
 * 1. 用 appSecret 获取 access_token
 * 2. 用 access_token 生成最终签名
 */
export async function generateVerifyConfig() {
  const nonce = crypto.randomBytes(16).toString('hex')
  // 时间戳往前调 10 分钟（小红书服务器时间走的慢）
  const timestamp = (Date.now() - 10 * 60 * 1000).toString()

  // 第一步：获取 access_token
  const accessToken = await getAccessToken(nonce, timestamp)

  if (!accessToken) {
    // 如果获取 token 失败，尝试直接用 appSecret 签名（可能不会工作，但作为后备）
    console.warn('无法获取 access_token，尝试直接签名')
    const signature = generateSignature(nonce, timestamp, APP_SECRET)
    return {
      appKey: APP_KEY,
      nonce,
      timestamp: parseInt(timestamp, 10),
      signature,
    }
  }

  // 第二步：用 access_token 生成最终签名
  const signature = generateSignature(nonce, timestamp, accessToken)

  return {
    appKey: APP_KEY,
    nonce,
    timestamp: parseInt(timestamp, 10),
    signature,
  }
}

export type VerifyConfig = Awaited<ReturnType<typeof generateVerifyConfig>>
