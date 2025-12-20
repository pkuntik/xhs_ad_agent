import { ObjectId } from 'mongodb'

// 远程笔记（从聚光平台同步）
export interface RemoteNote {
  _id: ObjectId
  accountId: ObjectId           // 关联账号
  noteId: string                // 小红书笔记 ID
  title: string                 // 笔记标题
  coverImage: string            // 封面图片
  noteType: number              // 笔记类型 1=图文, 2=视频
  authorName: string            // 作者名称
  publishedAt: Date             // 发布时间

  // 数据统计（每次同步更新）
  reads: number                 // 阅读数
  likes: number                 // 点赞数
  comments: number              // 评论数
  favorites: number             // 收藏数

  // 推广状态
  canHeat: boolean              // 是否可加热推广
  cantHeatDesc?: string         // 不可推广原因

  // 安全令牌
  xsecToken: string

  // 同步时间
  syncedAt: Date                // 最后同步时间
  createdAt: Date               // 首次同步时间
}

// 客户端使用的序列化版本
export interface RemoteNoteItem extends Omit<RemoteNote, '_id' | 'accountId'> {
  _id: string
  accountId: string
}
