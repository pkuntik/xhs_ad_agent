'use server'

import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import type { CreationHistory, CreationFormData, GenerationResult } from '@/types/creation'

/**
 * 序列化 MongoDB 文档
 */
function serialize<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc))
}

/**
 * 保存创作历史
 */
export async function saveCreationHistory(
  formData: CreationFormData,
  result: GenerationResult
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const db = await getDb()

    const history: Omit<CreationHistory, '_id'> = {
      formData,
      result,
      title: result.title?.text || formData.topic.slice(0, 20) || '未命名',
      createdAt: new Date(),
    }

    const insertResult = await db
      .collection(COLLECTIONS.CREATION_HISTORY)
      .insertOne(history)

    return {
      success: true,
      id: insertResult.insertedId.toString(),
    }
  } catch (error) {
    console.error('保存创作历史失败:', error)
    return {
      success: false,
      error: '保存失败',
    }
  }
}

/**
 * 获取创作历史列表
 */
export async function getCreationHistoryList(
  limit: number = 20
): Promise<CreationHistory[]> {
  try {
    const db = await getDb()

    const histories = await db
      .collection<CreationHistory>(COLLECTIONS.CREATION_HISTORY)
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return histories.map(serialize)
  } catch (error) {
    console.error('获取创作历史列表失败:', error)
    return []
  }
}

/**
 * 获取单条创作历史详情
 */
export async function getCreationHistoryById(
  id: string
): Promise<CreationHistory | null> {
  try {
    const db = await getDb()

    const history = await db
      .collection<CreationHistory>(COLLECTIONS.CREATION_HISTORY)
      .findOne({ _id: new ObjectId(id) as any })

    return history ? serialize(history) : null
  } catch (error) {
    console.error('获取创作历史详情失败:', error)
    return null
  }
}

/**
 * 删除创作历史
 */
export async function deleteCreationHistory(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    await db
      .collection<CreationHistory>(COLLECTIONS.CREATION_HISTORY)
      .deleteOne({ _id: new ObjectId(id) as any })

    return { success: true }
  } catch (error) {
    console.error('删除创作历史失败:', error)
    return {
      success: false,
      error: '删除失败',
    }
  }
}
