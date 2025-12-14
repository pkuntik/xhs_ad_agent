import { ObjectId } from 'mongodb'
import type { GenerationResult } from './creation'

// 作品状态
export type WorkStatus = 'unused' | 'scanned' | 'published' | 'promoting' | 'paused' | 'archived'

// 作品类型
export type WorkType = 'image' | 'video'

// 作品
export interface Work {
  _id: ObjectId
  accountId?: ObjectId            // 关联账号（发布后关联）

  // 笔记信息
  noteId?: string                 // 小红书笔记 ID（发布后填写）
  noteUrl?: string                // 小红书笔记链接
  title: string                   // 笔记标题
  content?: string                // 笔记内容
  coverUrl?: string               // 封面图 URL
  type: WorkType                  // 笔记类型

  // AI 生成的完整内容
  draftContent?: GenerationResult

  // 发布码
  publishCode: string             // 唯一短码 (nanoid)
  publishCodeCreatedAt: Date      // 创建时间
  publishCodeScannedAt?: Date     // 扫码时间
  publishCodePublishedAt?: Date   // 发布时间

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

// 创建作品的输入（从 AI 生成保存）
export interface CreateWorkInput {
  title: string
  content?: string
  coverUrl?: string
  type?: WorkType
  tags?: string[]
  draftContent?: GenerationResult
}

// 绑定已发布笔记的输入
export interface BindNoteInput {
  noteId?: string
  noteUrl: string
  accountId?: string
}
