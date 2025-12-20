'use server'

import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { getUploadPermit, publishNote, downloadImage, type NoteHashTag } from '@/lib/xhs/api/publish'
import type { XhsAccount } from '@/types/account'
import type { Work } from '@/types/work'

// 发布笔记输入
export interface PublishNoteInput {
  accountId: string
  title: string
  content: string
  imageUrls: string[]        // 图片 URL 列表
  hashTags?: string[]        // 话题标签名称
}

// 从作品发布输入
export interface PublishFromWorkInput {
  accountId: string
  workId: string
}

// 发布结果
export interface PublishNoteResult {
  success: boolean
  error?: string
  data?: {
    noteId: string
    shareLink: string
  }
}

/**
 * 解析内容中的话题标签
 */
function parseHashTags(content: string): NoteHashTag[] {
  const tagRegex = /#([^#\s\[\]]+)\[话题\]#/g
  const tags: NoteHashTag[] = []
  let match

  while ((match = tagRegex.exec(content)) !== null) {
    tags.push({
      id: '',  // 需要从 API 获取真实 ID
      name: match[1],
      link: '',
      type: 'topic',
    })
  }

  return tags
}

/**
 * 上传单张图片并返回 file_id
 */
async function uploadSingleImage(
  cookie: string,
  imageUrl: string
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  try {
    // 1. 获取上传凭证
    const permitResult = await getUploadPermit(cookie, { fileCount: 1 })

    if (!permitResult.uploadTempPermits || permitResult.uploadTempPermits.length === 0) {
      return { success: false, error: '获取上传凭证失败' }
    }

    const permit = permitResult.uploadTempPermits[0]
    const fileId = permit.fileIds[0]

    // 2. 下载图片
    const imageBuffer = await downloadImage(imageUrl)

    // 3. 上传到 ROS
    const uploadUrl = `https://${permit.uploadAddr}/${fileId}`

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': imageBuffer.length.toString(),
        'x-cos-security-token': permit.token,
      },
      body: new Uint8Array(imageBuffer),
    })

    if (!response.ok) {
      return { success: false, error: `上传图片失败: ${response.status}` }
    }

    return { success: true, fileId }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '上传图片失败',
    }
  }
}

/**
 * 从作品发布笔记到小红书
 */
export async function publishFromWork(input: PublishFromWorkInput): Promise<PublishNoteResult> {
  try {
    const { accountId, workId } = input
    const db = await getDb()

    // 获取作品
    const work = await db
      .collection<Work>(COLLECTIONS.WORKS)
      .findOne({ _id: new ObjectId(workId) })

    if (!work) {
      return { success: false, error: '作品不存在' }
    }

    // 从作品提取发布内容
    const title = work.draftContent?.title?.text || work.title || ''
    const content = work.draftContent?.content?.body || work.content || ''

    // 提取图片 URL
    const imageUrls: string[] = []

    // 先添加封面图
    if (work.draftContent?.cover?.imageUrl) {
      imageUrls.push(work.draftContent.cover.imageUrl)
    } else if (work.coverUrl) {
      imageUrls.push(work.coverUrl)
    }

    // 添加其他图片
    if (work.draftContent?.images && work.draftContent.images.length > 0) {
      for (const img of work.draftContent.images) {
        if (img.imageUrl && !imageUrls.includes(img.imageUrl)) {
          imageUrls.push(img.imageUrl)
        }
      }
    }

    if (imageUrls.length === 0) {
      return { success: false, error: '作品没有可发布的图片' }
    }

    // 调用发布函数
    return publishNoteToXhs({
      accountId,
      title,
      content,
      imageUrls,
    })
  } catch (error) {
    console.error('从作品发布失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '发布失败',
    }
  }
}

/**
 * 发布笔记到小红书
 */
export async function publishNoteToXhs(input: PublishNoteInput): Promise<PublishNoteResult> {
  try {
    const { accountId, title, content, imageUrls } = input

    if (!title || title.length === 0) {
      return { success: false, error: '标题不能为空' }
    }

    if (!imageUrls || imageUrls.length === 0) {
      return { success: false, error: '至少需要一张图片' }
    }

    const db = await getDb()

    // 获取账号信息
    const account = await db
      .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
      .findOne({ _id: new ObjectId(accountId) })

    if (!account) {
      return { success: false, error: '账号不存在' }
    }

    if (!account.cookie) {
      return { success: false, error: '账号未配置登录凭证' }
    }

    if (account.status === 'cookie_expired') {
      return { success: false, error: 'Cookie 已过期，请重新登录' }
    }

    // 上传所有图片
    const uploadedImages: { file_id: string; height: number; width: number }[] = []

    for (const imageUrl of imageUrls) {
      const result = await uploadSingleImage(account.cookie, imageUrl)
      if (!result.success || !result.fileId) {
        return { success: false, error: result.error || '上传图片失败' }
      }

      uploadedImages.push({
        file_id: result.fileId,
        height: 1080,  // 默认尺寸，实际应该从图片元数据获取
        width: 1080,
      })
    }

    // 解析话题标签
    const hashTags = parseHashTags(content)

    // 发布笔记
    const publishResult = await publishNote(account.cookie, {
      common: {
        type: 'normal',
        title,
        desc: content,
        hash_tags: hashTags.length > 0 ? hashTags : undefined,
        post_loc: {
          poi_id: '',
          name: '',
          subname: '',
          poi_type: -1,
        },
        biz_relations: [],
      },
      image_info: {
        images: uploadedImages,
      },
      video_info: null,
      material_note_id: null,
      platform: 1,
      user_type: 1,
      user_id: account.visitorUserId,
      operate: 2,
    })

    return {
      success: true,
      data: {
        noteId: publishResult.note_id,
        shareLink: publishResult.share_link,
      },
    }
  } catch (error) {
    console.error('发布笔记失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '发布笔记失败',
    }
  }
}
