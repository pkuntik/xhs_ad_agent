import { ObjectId } from 'mongodb'

// 计划状态
export type CampaignStatus = 'pending' | 'active' | 'paused' | 'completed' | 'failed'

// 投放目标
export type CampaignObjective = 'lead_collection' // 私信咨询量

// 投放类型
export type CampaignType = 'chips' | 'leona'  // 薯条 或 聚光

// 定向配置
export interface CampaignTargeting {
  regions?: string[]              // 地域定向
  ages?: string[]                 // 年龄定向
  genders?: string[]              // 性别定向
  interests?: string[]            // 兴趣定向
}

// 投放计划
export interface Campaign {
  _id: ObjectId
  accountId: ObjectId
  workId: ObjectId

  // 投放类型
  type?: CampaignType             // 默认 'chips'

  // 薯条订单信息
  orderNo?: string                // 薯条订单号

  // 聚光平台信息（保留兼容）
  campaignId?: string             // 聚光计划 ID
  unitId?: string                 // 单元 ID

  // 计划配置
  name: string
  objective: CampaignObjective    // 目标: 私信咨询量
  budget: number                  // 计划预算（元）
  duration?: number               // 投放时长（秒）
  bidAmount?: number              // 出价（聚光用）

  // 定向配置
  targeting: CampaignTargeting

  // 状态
  status: CampaignStatus

  // 当前批次信息
  currentBatch: number            // 当前投放批次
  batchStartAt: Date              // 批次开始时间

  createdAt: Date
  updatedAt: Date
}

// 创建计划的输入
export interface CreateCampaignInput {
  workId: string
  budget?: number
  bidAmount?: number
  targeting?: CampaignTargeting
}
