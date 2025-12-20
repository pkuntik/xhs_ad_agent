import { ObjectId } from 'mongodb'

// 关联作者状态
export type LinkedAuthorStatus = 'pending' | 'linked'

// 关联作者（从笔记中发现但尚未添加完整账号的作者）
export interface LinkedAuthor {
  _id: ObjectId
  userId: string              // 小红书用户ID (visitorUserId)
  nickname: string            // 昵称
  avatar: string              // 头像URL
  linkedAt: Date              // 关联时间
  accountId?: ObjectId        // 关联的完整账号ID（添加cookie后）
  status: LinkedAuthorStatus  // 状态
  createdBy: ObjectId         // 创建者（系统用户ID）
  createdAt: Date
  updatedAt: Date
}

// 创建关联作者的输入
export interface CreateLinkedAuthorInput {
  userId: string
  nickname: string
  avatar: string
}

// 关联作者列表项
export interface LinkedAuthorListItem {
  _id: string
  userId: string
  nickname: string
  avatar: string
  linkedAt: Date
  accountId?: string
  status: LinkedAuthorStatus
}
