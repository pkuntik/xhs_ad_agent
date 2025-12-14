'use server'

import { revalidatePath } from 'next/cache'
import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import type { Work, CreateWorkInput, WorkStatus } from '@/types/work'

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

  return works
}

/**
 * 获取单个作品详情
 */
export async function getWorkById(id: string): Promise<Work | null> {
  const db = await getDb()
  const work = await db
    .collection<Work>(COLLECTIONS.WORKS)
    .findOne({ _id: new ObjectId(id) })

  return work
}

/**
 * 绑定作品（手动发布后，输入笔记 ID 绑定）
 */
export async function createWork(
  input: CreateWorkInput
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

  return works
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

  return work
}
