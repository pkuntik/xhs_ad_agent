'use server'

import { ObjectId } from 'mongodb'
import { revalidatePath } from 'next/cache'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { getCurrentUser } from '@/lib/auth/session'
import type {
  NoteSyncSettings,
  UpdateSyncSettingsInput,
  DEFAULT_SYNC_SETTINGS,
} from '@/types/settings'

// 获取当前用户的同步设置
export async function getNoteSyncSettings(): Promise<{
  success: boolean
  settings?: NoteSyncSettings
  error?: string
}> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: '请先登录' }
    }

    const db = await getDb()
    const settings = await db
      .collection(COLLECTIONS.SETTINGS)
      .findOne({ userId: new ObjectId(user.userId), type: 'note_sync' })

    if (!settings) {
      // 返回默认设置
      const { DEFAULT_SYNC_SETTINGS } = await import('@/types/settings')
      return {
        success: true,
        settings: {
          userId: new ObjectId(user.userId),
          ...DEFAULT_SYNC_SETTINGS,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as NoteSyncSettings,
      }
    }

    return {
      success: true,
      settings: settings as unknown as NoteSyncSettings,
    }
  } catch (error) {
    console.error('getNoteSyncSettings error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取同步设置失败',
    }
  }
}

// 更新同步设置
export async function updateNoteSyncSettings(
  input: UpdateSyncSettingsInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: '请先登录' }
    }

    const db = await getDb()
    const userId = new ObjectId(user.userId)

    // 检查是否存在设置
    const existing = await db
      .collection(COLLECTIONS.SETTINGS)
      .findOne({ userId, type: 'note_sync' })

    const now = new Date()

    if (existing) {
      // 更新现有设置
      const updateData: Record<string, unknown> = {
        updatedAt: now,
      }

      if (input.enabled !== undefined) {
        updateData.enabled = input.enabled
      }
      if (input.adaptiveSync !== undefined) {
        updateData.adaptiveSync = input.adaptiveSync
      }
      if (input.adaptiveMultiplier !== undefined) {
        updateData.adaptiveMultiplier = input.adaptiveMultiplier
      }
      if (input.strategies) {
        for (const [key, value] of Object.entries(input.strategies)) {
          if (value !== undefined) {
            updateData[`strategies.${key}`] = value
          }
        }
      }

      await db.collection(COLLECTIONS.SETTINGS).updateOne(
        { userId, type: 'note_sync' },
        { $set: updateData }
      )
    } else {
      // 创建新设置
      const { DEFAULT_SYNC_SETTINGS } = await import('@/types/settings')
      const newSettings = {
        userId,
        type: 'note_sync',
        ...DEFAULT_SYNC_SETTINGS,
        ...input,
        strategies: {
          ...DEFAULT_SYNC_SETTINGS.strategies,
          ...input.strategies,
        },
        createdAt: now,
        updatedAt: now,
      }

      await db.collection(COLLECTIONS.SETTINGS).insertOne(newSettings)
    }

    revalidatePath('/settings/sync')
    return { success: true }
  } catch (error) {
    console.error('updateNoteSyncSettings error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新同步设置失败',
    }
  }
}
