import { ObjectId } from 'mongodb'

// 作品状态
export type WorkStatus = 'draft' | 'published' | 'promoting' | 'paused' | 'archived'

// 作品类型
export type WorkType = 'image' | 'video'

// 作品
export interface Work {
  _id: ObjectId
  accountId: ObjectId             // 关联账号

  // 笔记信息
  noteId: string                  // 小红书笔记 ID
  title: string                   // 笔记标题
  content?: string                // 笔记内容
  coverUrl?: string               // 封面图 URL
  type: WorkType                  // 笔记类型

  // 投放状态
  status: WorkStatus

  // 投放统计汇总
  totalSpent: number              // 总消耗
  totalImpressions: number        // 总展现
  totalClicks: number             // 总点击
  totalLeads: number              // 总咨询数
  avgCostPerLead: number          // 平均咨询成本

  // 历史效果评分
  performanceScore: number        // AI 计算的效果评分 (0-100)
  consecutiveFailures: number     // 连续失败次数

  // 标签 (用于 AI 分析)
  tags: string[]

  createdAt: Date
  updatedAt: Date
}

// 创建作品的输入
export interface CreateWorkInput {
  accountId: string
  noteId: string
  title: string
  content?: string
  coverUrl?: string
  type?: WorkType
  tags?: string[]
}
