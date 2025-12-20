'use server'

import { revalidatePath } from 'next/cache'
import { ObjectId } from 'mongodb'
import { nanoid } from 'nanoid'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { generateVerifyConfig } from '@/lib/xhs/signature'
import type { Work, CreateWorkInput, WorkStatus, BindNoteInput } from '@/types/work'
import type { GenerationResult } from '@/types/creation'
import { getCurrentUserId } from '@/lib/auth/session'
import { deductBalance } from '@/lib/billing/service'

/**
 * 序列化 MongoDB 文档，将 ObjectId 和 Date 转换为字符串
 */
function serializeWork<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc))
}

/**
 * 获取作品列表
 */
export async function getWorks(accountId?: string): Promise<Work[]> {
  const db = await getDb()

  const query = accountId ? { accountId: new ObjectId(accountId) } : {}

  const works = await db
    .collection<Work>(COLLECTIONS.WORKS)
    .find(query)
    .sort({ createdAt: -1 })
    .toArray()

  return works.map(serializeWork)
}

/**
 * 获取单个作品详情
 */
export async function getWorkById(id: string): Promise<Work | null> {
  const db = await getDb()
  const work = await db
    .collection<Work>(COLLECTIONS.WORKS)
    .findOne({ _id: new ObjectId(id) })

  return work ? serializeWork(work) : null
}

/**
 * 保存 AI 生成的内容为作品
 */
export async function saveWork(
  input: CreateWorkInput
): Promise<{ success: boolean; error?: string; id?: string; publishCode?: string }> {
  try {
    const { title, content, coverUrl, type = 'image', tags = [], draftContent } = input

    const db = await getDb()

    // 生成唯一发布码
    const publishCode = nanoid(10)

    const work: Omit<Work, '_id'> = {
      title,
      content,
      coverUrl,
      type,
      draftContent,
      publishCode,
      publishCodeCreatedAt: new Date(),
      status: 'unused',
      totalSpent: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalLeads: 0,
      avgCostPerLead: 0,
      performanceScore: 50,
      consecutiveFailures: 0,
      tags,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.collection(COLLECTIONS.WORKS).insertOne(work)

    revalidatePath('/works')
    return { success: true, id: result.insertedId.toString(), publishCode }
  } catch (error) {
    console.error('保存作品失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 绑定作品（手动发布后，输入笔记 ID 绑定）- 旧版兼容
 */
export async function createWork(
  input: CreateWorkInput & { accountId: string; noteId: string }
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { accountId, noteId, title, content, coverUrl, type = 'image', tags = [] } = input

    const db = await getDb()

    // 检查是否已存在
    const existing = await db
      .collection(COLLECTIONS.WORKS)
      .findOne({ noteId, accountId: new ObjectId(accountId) })
    if (existing) {
      return { success: false, error: '该作品已绑定' }
    }

    const work: Omit<Work, '_id'> = {
      accountId: new ObjectId(accountId),
      noteId,
      title,
      content,
      coverUrl,
      type,
      publishCode: nanoid(10),
      publishCodeCreatedAt: new Date(),
      publishCodePublishedAt: new Date(),
      status: 'published',
      totalSpent: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalLeads: 0,
      avgCostPerLead: 0,
      performanceScore: 50, // 初始评分
      consecutiveFailures: 0,
      tags,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.collection(COLLECTIONS.WORKS).insertOne(work)

    revalidatePath('/works')
    revalidatePath(`/accounts/${accountId}`)
    return { success: true, id: result.insertedId.toString() }
  } catch (error) {
    console.error('绑定作品失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 更新作品信息
 */
export async function updateWork(
  id: string,
  data: Partial<Pick<Work, 'title' | 'content' | 'coverUrl' | 'tags'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      }
    )

    revalidatePath('/works')
    revalidatePath(`/works/${id}`)
    return { success: true }
  } catch (error) {
    console.error('更新作品失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 更新作品状态
 */
export async function updateWorkStatus(
  id: string,
  status: WorkStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    )

    revalidatePath('/works')
    revalidatePath(`/works/${id}`)
    return { success: true }
  } catch (error) {
    console.error('更新作品状态失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 归档作品
 */
export async function archiveWork(id: string): Promise<{ success: boolean; error?: string }> {
  return updateWorkStatus(id, 'archived')
}

/**
 * 更新作品统计数据
 */
export async function updateWorkStats(
  id: string,
  stats: Partial<Pick<Work, 'totalSpent' | 'totalImpressions' | 'totalClicks' | 'totalLeads'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    // 计算平均咨询成本
    const avgCostPerLead =
      stats.totalLeads && stats.totalLeads > 0 && stats.totalSpent
        ? stats.totalSpent / stats.totalLeads
        : 0

    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...stats,
          avgCostPerLead,
          updatedAt: new Date(),
        },
      }
    )

    revalidatePath(`/works/${id}`)
    return { success: true }
  } catch (error) {
    console.error('更新作品统计失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 增加作品连续失败次数
 */
export async function incrementWorkFailures(id: string): Promise<number> {
  const db = await getDb()

  const result = await db.collection(COLLECTIONS.WORKS).findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $inc: { consecutiveFailures: 1 },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  )

  return result?.consecutiveFailures || 0
}

/**
 * 重置作品连续失败次数
 */
export async function resetWorkFailures(id: string): Promise<{ success: boolean }> {
  const db = await getDb()

  await db.collection(COLLECTIONS.WORKS).updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        consecutiveFailures: 0,
        updatedAt: new Date(),
      },
    }
  )

  return { success: true }
}

/**
 * 获取账号下可用于投放的作品
 */
export async function getAvailableWorks(accountId: string): Promise<Work[]> {
  const db = await getDb()

  const works = await db
    .collection<Work>(COLLECTIONS.WORKS)
    .find({
      accountId: new ObjectId(accountId),
      status: 'published',
    })
    .sort({ performanceScore: -1, createdAt: -1 })
    .toArray()

  return works.map(serializeWork)
}

/**
 * 获取下一个最佳作品（用于自动切换）
 */
export async function getNextBestWork(
  accountId: string,
  excludeWorkId?: string
): Promise<Work | null> {
  const db = await getDb()

  const query: Record<string, unknown> = {
    accountId: new ObjectId(accountId),
    status: 'published',
    consecutiveFailures: { $lt: 3 }, // 排除失败次数过多的作品
  }

  if (excludeWorkId) {
    query._id = { $ne: new ObjectId(excludeWorkId) }
  }

  const work = await db
    .collection<Work>(COLLECTIONS.WORKS)
    .findOne(query, {
      sort: { performanceScore: -1, consecutiveFailures: 1, createdAt: -1 },
    })

  return work ? serializeWork(work) : null
}

// ============ 发布码相关功能 ============

/**
 * 根据发布码获取作品
 */
export async function getWorkByPublishCode(code: string): Promise<Work | null> {
  const db = await getDb()
  const work = await db
    .collection<Work>(COLLECTIONS.WORKS)
    .findOne({ publishCode: code })

  return work ? serializeWork(work) : null
}

/**
 * 获取发布配置（用于 H5 页面调用小红书 SDK）
 */
export async function getPublishConfig(code: string): Promise<{
  success: boolean
  error?: string
  work?: Work
  verifyConfig?: Awaited<ReturnType<typeof generateVerifyConfig>>
}> {
  try {
    const work = await getWorkByPublishCode(code)
    if (!work) {
      return { success: false, error: '作品不存在' }
    }

    // 生成签名配置（异步，需要获取 access_token）
    const verifyConfig = await generateVerifyConfig()

    return { success: true, work, verifyConfig }
  } catch (error) {
    console.error('获取发布配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 标记作品已扫码
 */
export async function markWorkScanned(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 获取当前用户并扣费
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: '请先登录' }
    }

    const deductResult = await deductBalance(userId, 'publish_scan', {
      relatedType: 'work',
      description: '扫码发布',
      metadata: { publishCode: code },
    })

    if (!deductResult.success) {
      return { success: false, error: deductResult.error }
    }

    const db = await getDb()

    const result = await db.collection(COLLECTIONS.WORKS).updateOne(
      { publishCode: code, status: 'unused' },
      {
        $set: {
          status: 'scanned',
          publishCodeScannedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    )

    if (result.matchedCount === 0) {
      // 可能已经扫过了，不报错
      return { success: true }
    }

    revalidatePath('/works')
    return { success: true }
  } catch (error) {
    console.error('标记作品已扫码失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 绑定已发布的笔记链接
 */
export async function bindPublishedNote(
  code: string,
  input: BindNoteInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { noteId, noteUrl, accountId, noteDetail, snapshot } = input
    const db = await getDb()

    // 先查询作品，检查是否已存在相同笔记
    const work = await db.collection(COLLECTIONS.WORKS).findOne({ publishCode: code })
    if (!work) {
      return { success: false, error: '作品不存在' }
    }

    // 检查是否重复
    if (noteId && work.publications?.some((pub: { noteId?: string }) => pub.noteId === noteId)) {
      return { success: false, error: '该笔记已绑定，请勿重复添加' }
    }

    // 创建新的发布记录（包含详情和快照）
    const publication: Record<string, unknown> = {
      noteId,
      noteUrl,
      accountId,
      publishedAt: new Date(),
    }

    // 添加笔记详情
    if (noteDetail) {
      publication.noteDetail = noteDetail
    }

    // 添加数据快照
    if (snapshot) {
      publication.snapshots = [snapshot]
      publication.lastSyncAt = new Date()
    }

    // 使用 $push 添加到 publications 数组，同时更新兼容字段
    const updateData: Record<string, unknown> = {
      noteUrl,  // 保留兼容字段（最新的链接）
      status: 'published',
      publishCodePublishedAt: new Date(),
      updatedAt: new Date(),
    }

    if (noteId) {
      updateData.noteId = noteId
    }

    if (accountId) {
      updateData.accountId = new ObjectId(accountId)
    }

    await db.collection(COLLECTIONS.WORKS).updateOne(
      { publishCode: code },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        $set: updateData,
        $push: { publications: publication }
      } as any
    )

    revalidatePath('/works')
    return { success: true }
  } catch (error) {
    console.error('绑定笔记链接失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 更新作品内容（包括 draftContent）
 */
export async function updateWorkContent(
  id: string,
  data: Partial<Pick<Work, 'title' | 'content' | 'coverUrl' | 'tags' | 'draftContent'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      }
    )

    revalidatePath('/works')
    revalidatePath(`/works/${id}`)
    return { success: true }
  } catch (error) {
    console.error('更新作品内容失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 更新作品图片（用于在作品详情页生成图片后保存）
 */
export async function updateWorkImages(
  id: string,
  draftContent: Work['draftContent']
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          draftContent,
          updatedAt: new Date(),
        },
      }
    )

    revalidatePath('/works')
    revalidatePath(`/works/${id}`)
    return { success: true }
  } catch (error) {
    console.error('更新作品图片失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 获取可发布的作品列表（有完整内容的作品）
 */
export async function getPublishableWorks(): Promise<Work[]> {
  const db = await getDb()

  const works = await db
    .collection<Work>(COLLECTIONS.WORKS)
    .find({
      // 有标题的作品
      $or: [
        { 'draftContent.title.text': { $exists: true, $ne: '' } },
        { title: { $exists: true, $ne: '' } },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()

  return works.map(serializeWork)
}
