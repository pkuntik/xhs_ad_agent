import { ObjectId } from 'mongodb'

// 笔记同步设置
export interface NoteSyncSettings {
  _id?: ObjectId
  userId: ObjectId              // 用户ID
  enabled: boolean              // 是否启用自动同步
  strategies: {
    newNoteInterval: number     // 新笔记同步间隔（分钟），默认 30
    newNoteThreshold: number    // 新笔记阈值（小时），默认 24
    recentNoteInterval: number  // 近期笔记同步间隔（分钟），默认 120
    recentNoteThreshold: number // 近期笔记阈值（天），默认 7
    oldNoteInterval: number     // 较老笔记同步间隔（分钟），默认 360
  }
  adaptiveSync: boolean         // 自适应同步（根据数据变化自动调整）
  adaptiveMultiplier: number    // 自适应倍率（数据变化时加快的倍数）
  createdAt: Date
  updatedAt: Date
}

// 默认同步设置
export const DEFAULT_SYNC_SETTINGS: Omit<NoteSyncSettings, '_id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  strategies: {
    newNoteInterval: 30,        // 30分钟
    newNoteThreshold: 24,       // 24小时内算新笔记
    recentNoteInterval: 120,    // 2小时
    recentNoteThreshold: 7,     // 7天内算近期笔记
    oldNoteInterval: 360,       // 6小时
  },
  adaptiveSync: true,
  adaptiveMultiplier: 2,
}

// 同步设置输入
export interface UpdateSyncSettingsInput {
  enabled?: boolean
  strategies?: Partial<NoteSyncSettings['strategies']>
  adaptiveSync?: boolean
  adaptiveMultiplier?: number
}
