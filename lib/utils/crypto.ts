import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'xhs-ad-agent-secret-key-32chars!'
const IV_LENGTH = 16
const ALGORITHM = 'aes-256-cbc'

// 确保密钥长度为 32 字节
function getKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)
  return Buffer.from(key)
}

/**
 * 加密 Cookie
 */
export function encryptCookie(cookie: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)

  let encrypted = cipher.update(cookie, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return iv.toString('hex') + ':' + encrypted
}

/**
 * 解密 Cookie
 */
export function decryptCookie(encrypted: string): string {
  const [ivHex, encryptedData] = encrypted.split(':')
  const iv = Buffer.from(ivHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * 生成随机密钥
 */
export function generateSecretKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length)
}
