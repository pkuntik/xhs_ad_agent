'use server'

import { ObjectId } from 'mongodb'
import { revalidatePath } from 'next/cache'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { getCurrentUser } from '@/lib/auth/session'
import { fetchNoteDetail, extractNoteId } from '@/lib/xhs/api/note'
import type {
  NoteDetail,
  CachedNoteDetail,
  NoteSnapshot,
  parseNoteIndexes
} from '@/types/note'
import type { Publication } from '@/types/work'
import type { LinkedAuthor, CreateLinkedAuthorInput } from '@/types/author'

// 验证笔记并获取详情
export async function fetchAndValidateNote(noteUrl: string): Promise<{
  success: boolean
  noteId?: string
  noteDetail?: NoteDetail
  cachedDetail?: CachedNoteDetail
  snapshot?: NoteSnapshot
  existingAccount?: {
    _id: string
    name: string
    visitorUserId: string
  }
  linkedAuthor?: {
    _id: string
    nickname: string
    userId: string
  }
  error?: string
}> {
  try {
    // 提取笔记ID
    const noteId = extractNoteId(noteUrl)
    if (!noteId) {
      return { success: false, error: '无效的笔记链接格式' }
    }

    // 获取笔记详情
    const result = await fetchNoteDetail(noteId)
    if (!result.success || !result.detail) {
      return { success: false, error: result.error || '获取笔记详情失败' }
    }

    const detail = result.detail
    const { parseNoteIndexes } = await import('@/types/note')
    const indexes = parseNoteIndexes(detail.indexes)

    // 构建缓存的笔记详情
    const cachedDetail: CachedNoteDetail = {
      title: detail.baseInfo.title,
      content: detail.baseInfo.content,
      authorNickname: detail.baseInfo.author.nickname,
      authorUserId: detail.baseInfo.author.userId,
      authorAvatar: detail.baseInfo.author.userSImage,
      coverImage: detail.baseInfo.images[0]?.link,
      images: detail.baseInfo.images.map(img => img.link),
      createDate: detail.baseInfo.createDate,
      noteType: detail.baseInfo.noteType,
    }

    // 构建数据快照
    const snapshot: NoteSnapshot = {
      capturedAt: new Date(),
      impressions: indexes.impressions,
      reads: indexes.reads,
      interactions: indexes.interactions,
      likes: indexes.likes,
      collects: indexes.collects,
      comments: indexes.comments,
    }

    // 检查作者是否已在账号列表中
    const db = await getDb()
    const authorUserId = detail.baseInfo.author.userId

    const existingAccount = await db
      .collection(COLLECTIONS.ACCOUNTS)
      .findOne({ visitorUserId: authorUserId })

    if (existingAccount) {
      return {
        success: true,
        noteId,
        noteDetail: detail,
        cachedDetail,
        snapshot,
        existingAccount: {
          _id: existingAccount._id.toString(),
          name: existingAccount.name,
          visitorUserId: existingAccount.visitorUserId,
        },
      }
    }

    // 检查是否已有关联作者记录
    const linkedAuthor = await db
      .collection(COLLECTIONS.LINKED_AUTHORS)
      .findOne({ userId: authorUserId })

    if (linkedAuthor) {
      return {
        success: true,
        noteId,
        noteDetail: detail,
        cachedDetail,
        snapshot,
        linkedAuthor: {
          _id: linkedAuthor._id.toString(),
          nickname: linkedAuthor.nickname,
          userId: linkedAuthor.userId,
        },
      }
    }

    // 作者不在任何列表中
    return {
      success: true,
      noteId,
      noteDetail: detail,
      cachedDetail,
      snapshot,
    }
  } catch (error) {
    console.error('fetchAndValidateNote error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '验证笔记失败',
    }
  }
}

// 创建关联作者记录
export async function createLinkedAuthor(
  input: CreateLinkedAuthorInput
): Promise<{ success: boolean; authorId?: string; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: '请先登录' }
    }

    const db = await getDb()

    // 检查是否已存在
    const existing = await db
      .collection(COLLECTIONS.LINKED_AUTHORS)
      .findOne({ userId: input.userId })

    if (existing) {
      return { success: true, authorId: existing._id.toString() }
    }

    // 检查是否已有完整账号
    const existingAccount = await db
      .collection(COLLECTIONS.ACCOUNTS)
      .findOne({ visitorUserId: input.userId })

    if (existingAccount) {
      return { success: false, error: '该作者已有完整账号' }
    }

    const now = new Date()
    const author: Omit<LinkedAuthor, '_id'> = {
      userId: input.userId,
      nickname: input.nickname,
      avatar: input.avatar,
      linkedAt: now,
      status: 'pending',
      createdBy: new ObjectId(user.userId),
      createdAt: now,
      updatedAt: now,
    }

    const result = await db
      .collection(COLLECTIONS.LINKED_AUTHORS)
      .insertOne(author)

    revalidatePath('/accounts')

    return { success: true, authorId: result.insertedId.toString() }
  } catch (error) {
    console.error('createLinkedAuthor error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '创建关联作者失败',
    }
  }
}

// 获取关联作者列表
export async function getLinkedAuthors(): Promise<{
  success: boolean
  authors?: Array<{
    _id: string
    userId: string
    nickname: string
    avatar: string
    linkedAt: Date
    status: string
    accountId?: string
  }>
  error?: string
}> {
  try {
    const db = await getDb()

    const authors = await db
      .collection(COLLECTIONS.LINKED_AUTHORS)
      .find({})
      .sort({ linkedAt: -1 })
      .toArray()

    return {
      success: true,
      authors: authors.map((a) => ({
        _id: a._id.toString(),
        userId: a.userId,
        nickname: a.nickname,
        avatar: a.avatar,
        linkedAt: a.linkedAt,
        status: a.status,
        accountId: a.accountId?.toString(),
      })),
    }
  } catch (error) {
    console.error('getLinkedAuthors error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取关联作者列表失败',
    }
  }
}

// 同步笔记数据
export async function syncNoteData(
  workId: string,
  publicationIndex: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    const work = await db
      .collection(COLLECTIONS.WORKS)
      .findOne({ _id: new ObjectId(workId) })

    if (!work) {
      return { success: false, error: '作品不存在' }
    }

    const publications = work.publications || []
    if (publicationIndex < 0 || publicationIndex >= publications.length) {
      return { success: false, error: '发布记录不存在' }
    }

    const publication = publications[publicationIndex] as Publication
    const noteId = publication.noteId || extractNoteId(publication.noteUrl)

    if (!noteId) {
      return { success: false, error: '无法获取笔记ID' }
    }

    // 获取最新笔记数据
    const result = await fetchNoteDetail(noteId)
    if (!result.success || !result.detail) {
      return { success: false, error: result.error || '获取笔记详情失败' }
    }

    const detail = result.detail
    const { parseNoteIndexes } = await import('@/types/note')
    const indexes = parseNoteIndexes(detail.indexes)

    // 构建新快照
    const newSnapshot: NoteSnapshot = {
      capturedAt: new Date(),
      impressions: indexes.impressions,
      reads: indexes.reads,
      interactions: indexes.interactions,
      likes: indexes.likes,
      collects: indexes.collects,
      comments: indexes.comments,
    }

    // 更新缓存详情
    const cachedDetail: CachedNoteDetail = {
      title: detail.baseInfo.title,
      content: detail.baseInfo.content,
      authorNickname: detail.baseInfo.author.nickname,
      authorUserId: detail.baseInfo.author.userId,
      authorAvatar: detail.baseInfo.author.userSImage,
      coverImage: detail.baseInfo.images[0]?.link,
      images: detail.baseInfo.images.map(img => img.link),
      createDate: detail.baseInfo.createDate,
      noteType: detail.baseInfo.noteType,
    }

    // 计算下次同步时间
    const nextSyncAt = calculateNextSyncTime(publication, newSnapshot)

    // 更新数据库
    const updatePath = `publications.${publicationIndex}`
    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: new ObjectId(workId) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        $set: {
          [`${updatePath}.noteDetail`]: cachedDetail,
          [`${updatePath}.lastSyncAt`]: new Date(),
          [`${updatePath}.nextSyncAt`]: nextSyncAt,
          updatedAt: new Date(),
        },
        $push: {
          [`${updatePath}.snapshots`]: newSnapshot,
        },
      } as any
    )

    revalidatePath(`/works/${workId}`)

    return { success: true }
  } catch (error) {
    console.error('syncNoteData error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '同步笔记数据失败',
    }
  }
}

// 计算下次同步时间（基于发布时间和数据变化趋势）
function calculateNextSyncTime(
  publication: Publication,
  newSnapshot: NoteSnapshot
): Date {
  const now = new Date()
  const publishedAt = new Date(publication.publishedAt)
  const ageHours = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60)

  // 基础间隔（分钟）
  let intervalMinutes: number

  if (ageHours < 24) {
    // 新笔记：30分钟
    intervalMinutes = 30
  } else if (ageHours < 24 * 7) {
    // 近期笔记：2小时
    intervalMinutes = 120
  } else {
    // 较老笔记：6小时
    intervalMinutes = 360
  }

  // 自适应调整：如果数据变化大，缩短间隔
  const snapshots = publication.snapshots || []
  if (snapshots.length > 0) {
    const lastSnapshot = snapshots[snapshots.length - 1]
    const changeRate = calculateChangeRate(lastSnapshot, newSnapshot)

    if (changeRate > 0.1) {
      // 变化超过10%，缩短间隔
      intervalMinutes = Math.max(intervalMinutes * 0.5, 15)
    } else if (changeRate < 0.01 && snapshots.length >= 3) {
      // 连续3次变化小于1%，延长间隔
      intervalMinutes = Math.min(intervalMinutes * 1.5, 720)
    }
  }

  return new Date(now.getTime() + intervalMinutes * 60 * 1000)
}

// 计算数据变化率
function calculateChangeRate(
  oldSnapshot: NoteSnapshot,
  newSnapshot: NoteSnapshot
): number {
  const oldTotal = oldSnapshot.impressions + oldSnapshot.reads + oldSnapshot.interactions
  const newTotal = newSnapshot.impressions + newSnapshot.reads + newSnapshot.interactions

  if (oldTotal === 0) return newTotal > 0 ? 1 : 0
  return Math.abs(newTotal - oldTotal) / oldTotal
}

// 批量同步需要更新的笔记
export async function syncPendingNotes(): Promise<{
  success: boolean
  synced: number
  errors: number
}> {
  try {
    const db = await getDb()
    const now = new Date()

    // 找出需要同步的发布记录
    const works = await db
      .collection(COLLECTIONS.WORKS)
      .find({
        'publications.nextSyncAt': { $lte: now },
      })
      .toArray()

    let synced = 0
    let errors = 0

    for (const work of works) {
      const publications = work.publications || []
      for (let i = 0; i < publications.length; i++) {
        const pub = publications[i]
        if (pub.nextSyncAt && new Date(pub.nextSyncAt) <= now) {
          const result = await syncNoteData(work._id.toString(), i)
          if (result.success) {
            synced++
          } else {
            errors++
          }

          // 避免请求过快
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
    }

    return { success: true, synced, errors }
  } catch (error) {
    console.error('syncPendingNotes error:', error)
    return { success: false, synced: 0, errors: 1 }
  }
}
