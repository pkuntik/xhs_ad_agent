import crypto from 'crypto'

const APP_KEY = process.env.XHS_APP_KEY || 'red.gLvsVoksierVz0uF'
const APP_SECRET = process.env.XHS_APP_SECRET || 'f13a2266d1e2c32a553cb7a42ea63c48'

/**
 * 生成小红书 API 签名
 * 算法：SHA256(排序后的参数 + appSecret)
 */
export function generateSignature(nonce: string, timestamp: number): string {
  const params: Record<string, string> = {
    appKey: APP_KEY,
    nonce,
    timestamp: timestamp.toString(),
  }

  // 按字母顺序排序参数
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')

  // 拼接 appSecret 并计算 SHA256
  const signStr = sorted + APP_SECRET
  return crypto.createHash('sha256').update(signStr).digest('hex')
}

/**
 * 生成验证配置（用于 H5 页面调用 xhs.share）
 */
export function generateVerifyConfig() {
  const nonce = crypto.randomBytes(16).toString('hex')
  const timestamp = Date.now()
  const signature = generateSignature(nonce, timestamp)

  return {
    appKey: APP_KEY,
    nonce,
    timestamp,
    signature,
  }
}

export type VerifyConfig = ReturnType<typeof generateVerifyConfig>
