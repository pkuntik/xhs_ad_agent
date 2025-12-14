import { ObjectId } from 'mongodb'

// 线索状态
export type LeadStatus = 'new' | 'contacted' | 'converted' | 'invalid'

// 咨询线索
export interface Lead {
  _id: ObjectId
  accountId: ObjectId
  workId: ObjectId
  campaignId: ObjectId

  // 线索信息 (来自聚光 API 推送)
  leadId: string
  userNickname?: string
  province?: string
  city?: string
  phone?: string
  wechat?: string

  // 来源信息
  noteId: string
  unitId: string
  creativeId?: string

  // 状态
  status: LeadStatus

  // 价值评估 (用于 AI 优化)
  estimatedValue?: number

  receivedAt: Date
  createdAt: Date
}
