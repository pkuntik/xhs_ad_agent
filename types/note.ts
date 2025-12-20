import { ObjectId } from 'mongodb'

// 笔记作者信息
export interface NoteAuthor {
  nickname: string
  userId: string        // 小红书用户ID，对应 accounts 的 visitorUserId
  userSImage: string    // 头像URL
}

// 笔记数据指标
export interface NoteIndex {
  name: string          // 如 "总曝光量", "总阅读量", "总互动量"
  value: string
  tips?: string
}

// 笔记图片
export interface NoteImage {
  height: number
  width: number
  link: string
}

// 笔记评论
export interface NoteComment {
  content: string
  createTime: string
  likeNum: string
  user: {
    nickname: string
    userId: string
    userSImage: string
  }
}

// 笔记基本信息
export interface NoteBaseInfo {
  author: NoteAuthor
  content: string
  createDate: string
  images: NoteImage[]
  noteId: string
  noteLink: string
  noteType: string      // "1" = 图文, "2" = 视频
  title: string
  video?: Record<string, unknown>
}

// 笔记详情
export interface NoteDetail {
  baseInfo: NoteBaseInfo
  indexes: NoteIndex[]
}

// API 响应
export interface NoteDetailResponse {
  code: number
  data: {
    detail: NoteDetail
    comments: NoteComment[]
  }
  msg: string
  success: boolean
}

// 笔记数据快照（用于趋势分析）
export interface NoteSnapshot {
  capturedAt: Date
  impressions: number   // 曝光量
  reads: number         // 阅读量
  interactions: number  // 互动量
  likes: number         // 点赞量
  collects: number      // 收藏量
  comments: number      // 评论量
}

// 同步日志条目
export interface SyncLogEntry {
  syncedAt: Date
  success: boolean
  error?: string
  duration?: number     // 同步耗时（毫秒）
  snapshotBefore?: Partial<NoteSnapshot>
  snapshotAfter?: NoteSnapshot
}

// 缓存的笔记详情（存储在 Publication 中）
export interface CachedNoteDetail {
  title: string
  content: string
  authorNickname: string
  authorUserId: string
  authorAvatar: string
  coverImage?: string
  images: string[]
  createDate: string
  noteType: string
}

// 解析后的笔记指标
export interface ParsedNoteIndexes {
  impressions: number
  reads: number
  interactions: number
  likes: number
  collects: number
  comments: number
}

// 辅助函数：解析指标数值
export function parseNoteIndexes(indexes: NoteIndex[]): ParsedNoteIndexes {
  const result: ParsedNoteIndexes = {
    impressions: 0,
    reads: 0,
    interactions: 0,
    likes: 0,
    collects: 0,
    comments: 0,
  }

  for (const index of indexes) {
    const value = parseInt(index.value.replace(/,/g, ''), 10) || 0
    switch (index.name) {
      case '总曝光量':
        result.impressions = value
        break
      case '总阅读量':
        result.reads = value
        break
      case '总互动量':
        result.interactions = value
        break
      case '总点赞量':
        result.likes = value
        break
      case '总收藏量':
        result.collects = value
        break
      case '总评论量':
        result.comments = value
        break
    }
  }

  return result
}
