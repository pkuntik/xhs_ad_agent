import crypto from 'crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

/**
 * DogeCloud OSS 配置
 *
 * OSS_ACCESS_KEY / OSS_SECRET_KEY: 从多吉云控制台 - 密钥管理获取
 * OSS_BUCKET: 存储空间名称（在多吉云控制台创建的空间名，如 yeyeye）
 * OSS_PUBLIC_URL: 公开访问域名，如 https://ye.e-idear.com
 */
const OSS_CONFIG = {
  accessKey: process.env.OSS_ACCESS_KEY || '',
  secretKey: process.env.OSS_SECRET_KEY || '',
  bucket: process.env.OSS_BUCKET || '',
  publicUrl: process.env.OSS_PUBLIC_URL || '',
}

/**
 * DogeCloud API 签名生成
 * 参考: https://docs.dogecloud.com/oss/api-access-token
 */
function generateAccessToken(apiPath: string, body: string = ''): string {
  const signStr = `${apiPath}\n${body}`
  const hmac = crypto.createHmac('sha1', OSS_CONFIG.secretKey)
  hmac.update(Buffer.from(signStr, 'utf8'))
  const sign = hmac.digest('hex')
  return `${OSS_CONFIG.accessKey}:${sign}`
}

interface DogeCloudBucket {
  name: string
  s3Bucket: string
  s3Endpoint: string
}

interface DogeCloudCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}

/**
 * 调用 DogeCloud API 获取临时上传凭证
 * 参考: E:\idear\justus\engine\frontend\deploy.mjs
 */
async function getUploadToken(): Promise<{
  credentials: DogeCloudCredentials
  s3Bucket: string
  s3Endpoint: string
}> {
  const apiPath = '/auth/tmp_token.json'

  const body = JSON.stringify({
    channel: 'OSS_FULL',
    scopes: ['*'],
  })

  const accessToken = generateAccessToken(apiPath, body)

  const response = await fetch(`https://api.dogecloud.com${apiPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `TOKEN ${accessToken}`,
    },
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('DogeCloud API Error:', errorText)
    throw new Error(`获取上传凭证失败: ${response.status}`)
  }

  const result = await response.json() as {
    code: number
    msg: string
    data?: {
      Credentials: DogeCloudCredentials
      Buckets: DogeCloudBucket[]
    }
  }

  if (result.code !== 200) {
    throw new Error(result.msg || '获取上传凭证失败')
  }

  const data = result.data
  if (!data) {
    throw new Error('获取上传凭证失败: 响应数据为空')
  }

  // 获取凭证
  const credentials = data.Credentials
  if (!credentials?.accessKeyId || !credentials?.secretAccessKey) {
    console.error('Invalid credentials:', data)
    throw new Error('获取上传凭证失败: 凭证格式无效')
  }

  // 从 Buckets 列表中查找匹配的存储空间
  if (!data.Buckets || data.Buckets.length === 0) {
    throw new Error('获取上传凭证失败: 未找到存储空间列表')
  }

  console.log('Available buckets:', data.Buckets.map(b => ({ name: b.name, s3Bucket: b.s3Bucket })))

  const bucket = data.Buckets.find(b => b.name === OSS_CONFIG.bucket)
  if (!bucket) {
    const availableNames = data.Buckets.map(b => b.name).join(', ')
    throw new Error(`获取上传凭证失败: 未找到名为 "${OSS_CONFIG.bucket}" 的存储空间。可用的存储空间: ${availableNames}`)
  }

  console.log('DogeCloud bucket found:', {
    name: bucket.name,
    s3Bucket: bucket.s3Bucket,
    s3Endpoint: bucket.s3Endpoint,
  })

  return {
    credentials,
    s3Bucket: bucket.s3Bucket,
    s3Endpoint: bucket.s3Endpoint,
  }
}

/**
 * 创建 S3 客户端（使用临时凭证）
 * 注意：DogeCloud 的 s3Endpoint 可能是完整的虚拟主机域名或仅区域端点
 */
function createS3Client(
  credentials: DogeCloudCredentials,
  endpoint: string,
  bucket: string
): S3Client {
  // 检查 endpoint 是否已包含 bucket（虚拟主机风格）
  const endpointContainsBucket = endpoint.includes(bucket)

  let fullEndpoint: string
  let usePathStyle: boolean

  if (endpointContainsBucket) {
    // s3Endpoint 已经是完整的虚拟主机域名，直接使用
    fullEndpoint = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`
    usePathStyle = true // 防止 SDK 再次添加 bucket
  } else {
    // s3Endpoint 是区域端点，让 SDK 构建虚拟主机 URL
    fullEndpoint = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`
    usePathStyle = false
  }

  console.log('S3 config:', { fullEndpoint, usePathStyle, bucket })

  return new S3Client({
    region: 'automatic',
    endpoint: fullEndpoint,
    forcePathStyle: usePathStyle,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  })
}

/**
 * 上传文件到 OSS
 * @param key 文件路径/名称
 * @param body 文件内容 (Buffer)
 * @param contentType MIME 类型
 * @returns 公开访问 URL
 */
export async function uploadToOSS(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  // 获取临时上传凭证
  const { credentials, s3Bucket, s3Endpoint } = await getUploadToken()

  // 创建 S3 客户端
  const client = createS3Client(credentials, s3Endpoint, s3Bucket)

  // 上传文件
  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: 'public-read',
  })

  await client.send(command)

  // 返回公开访问 URL
  return `${OSS_CONFIG.publicUrl}/${key}`
}

/**
 * 获取 OSS 配置（用于检查是否配置）
 */
export function getOSSConfig() {
  return {
    isConfigured: !!(OSS_CONFIG.accessKey && OSS_CONFIG.secretKey && OSS_CONFIG.bucket),
    publicUrl: OSS_CONFIG.publicUrl,
    bucket: OSS_CONFIG.bucket,
  }
}
