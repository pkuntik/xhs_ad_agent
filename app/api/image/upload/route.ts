import { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { uploadToOSS, getOSSConfig } from '@/lib/oss/client'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { imageData, filename } = await req.json()

    if (!imageData) {
      return Response.json(
        { error: '请提供图片数据' },
        { status: 400 }
      )
    }

    // 检查 OSS 是否已配置
    const ossConfig = getOSSConfig()
    if (!ossConfig.isConfigured) {
      return Response.json(
        { error: 'OSS 未配置，请在 .env.local 中设置 OSS_ACCESS_KEY 和 OSS_SECRET_KEY' },
        { status: 500 }
      )
    }

    // 解析 base64 数据
    let base64Data = imageData
    let mimeType = 'image/png'

    if (imageData.startsWith('data:')) {
      const matches = imageData.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        mimeType = matches[1]
        base64Data = matches[2]
      }
    }

    // 确定文件扩展名
    const extMap: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
    }
    const ext = extMap[mimeType] || '.png'

    // 生成文件名和路径
    const finalFilename = filename ? `${filename}${ext}` : `${nanoid(12)}${ext}`
    const key = `images/${finalFilename}`

    // 转换为 Buffer
    const buffer = Buffer.from(base64Data, 'base64')

    // 上传到 OSS
    const imageUrl = await uploadToOSS(key, buffer, mimeType)

    return Response.json({
      success: true,
      imageUrl,
      filename: finalFilename,
    })

  } catch (error: unknown) {
    console.error('Image Upload Error:', error)
    const errorMessage = error instanceof Error ? error.message : '图片上传失败'
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
