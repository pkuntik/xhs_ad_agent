import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

/**
 * DogeCloud OSS 配置
 */
const OSS_CONFIG = {
  accessKeyId: process.env.OSS_ACCESS_KEY || '',
  secretAccessKey: process.env.OSS_SECRET_KEY || '',
  endpoint: process.env.OSS_ENDPOINT || 'https://cos.ap-shanghai.myqcloud.com',
  bucket: process.env.OSS_BUCKET || 'yeyeye',
  publicUrl: process.env.OSS_PUBLIC_URL || 'https://ye.e-idear.com',
}

/**
 * 创建 S3 客户端（用于 DogeCloud OSS）
 */
export function createOSSClient(): S3Client {
  if (!OSS_CONFIG.accessKeyId || !OSS_CONFIG.secretAccessKey) {
    throw new Error('OSS_ACCESS_KEY 或 OSS_SECRET_KEY 未配置')
  }

  return new S3Client({
    region: 'auto',
    endpoint: OSS_CONFIG.endpoint,
    credentials: {
      accessKeyId: OSS_CONFIG.accessKeyId,
      secretAccessKey: OSS_CONFIG.secretAccessKey,
    },
    forcePathStyle: true,
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
  const client = createOSSClient()

  const command = new PutObjectCommand({
    Bucket: OSS_CONFIG.bucket,
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
    isConfigured: !!(OSS_CONFIG.accessKeyId && OSS_CONFIG.secretAccessKey),
    publicUrl: OSS_CONFIG.publicUrl,
    bucket: OSS_CONFIG.bucket,
  }
}
