/**
 * 图片上传工具函数
 */

import { uploadImage } from '@/actions/image'

/**
 * 检查是否是 base64 图片数据
 */
export function isBase64Image(url: string | undefined | null): boolean {
  if (!url) return false
  return url.startsWith('data:image/')
}

/**
 * 上传 base64 图片到服务器
 * @param base64Data base64 图片数据（可以带或不带 data: 前缀）
 * @param filename 可选的文件名
 * @returns 上传后的图片 URL
 */
export async function uploadBase64Image(
  base64Data: string,
  filename?: string
): Promise<string> {
  const result = await uploadImage(base64Data, filename)

  if (!result.success || !result.imageUrl) {
    throw new Error(result.error || '图片上传失败')
  }

  return result.imageUrl
}

/**
 * 处理图片 URL，如果是 base64 则上传后返回 URL
 * @param imageUrl 图片 URL 或 base64 数据
 * @param filename 可选的文件名
 * @returns 处理后的图片 URL
 */
export async function processImageUrl(
  imageUrl: string | undefined | null,
  filename?: string
): Promise<string | undefined> {
  if (!imageUrl) return undefined

  // 如果是 base64 图片，上传后返回 URL
  if (isBase64Image(imageUrl)) {
    return await uploadBase64Image(imageUrl, filename)
  }

  // 如果是 blob URL，需要先转换为 base64
  if (imageUrl.startsWith('blob:')) {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const base64 = await blobToBase64(blob)
      return await uploadBase64Image(base64, filename)
    } catch (error) {
      console.error('Failed to process blob URL:', error)
      return undefined
    }
  }

  // 已经是普通 URL，直接返回
  return imageUrl
}

/**
 * 将 Blob 转换为 base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(reader.result as string)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
