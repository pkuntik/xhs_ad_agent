/**
 * 投放数据验证 Schema (Zod)
 */
import { z } from 'zod'

// 投放目标枚举
export const deliveryTargetSchema = z.enum([
  'read',         // 阅读
  'interact',     // 互动
  'consult',      // 咨询
  'follow',       // 粉丝关注
])

export type DeliveryTarget = z.infer<typeof deliveryTargetSchema>

// 投放决策枚举
export const deliveryDecisionSchema = z.enum([
  'continue',     // 继续投放
  'pause',        // 暂停投放
  'stop',         // 停止投放
  'increase',     // 追加预算
  'wait',         // 等待观察
])

export type DeliveryDecision = z.infer<typeof deliveryDecisionSchema>

// 创建投放计划验证
export const createCampaignInputSchema = z.object({
  accountId: z.string().regex(/^[0-9a-fA-F]{24}$/, '无效的账号 ID'),
  workId: z.string().regex(/^[0-9a-fA-F]{24}$/, '无效的作品 ID'),
  publicationIndex: z.number().min(0).default(0),
  budget: z.number().min(1, '预算不能小于1元'),
  duration: z.number().min(3600, '投放时长不能小于1小时').default(21600),
  target: deliveryTargetSchema.default('read'),
  bidAmount: z.number().min(1, '出价不能小于1分').optional(),
})

export type CreateCampaignInputSchema = z.infer<typeof createCampaignInputSchema>

// 投放检查参数验证
export const checkManagedCampaignParamsSchema = z.object({
  campaignId: z.string().regex(/^[0-9a-fA-F]{24}$/, '无效的投放计划 ID'),
  workId: z.string().regex(/^[0-9a-fA-F]{24}$/, '无效的作品 ID'),
  publicationIndex: z.number().min(0).default(0),
})

export type CheckManagedCampaignParams = z.infer<typeof checkManagedCampaignParamsSchema>

// 投放报告数据验证
export const reportDataSchema = z.object({
  impression: z.number().min(0).default(0),
  read: z.number().min(0).default(0),
  likes: z.number().min(0).default(0),
  comments: z.number().min(0).default(0),
  favorite: z.number().min(0).default(0),
  follow: z.number().min(0).default(0),
  homepageView: z.number().min(0).default(0),
  consume: z.number().min(0).default(0),
})

export type ReportData = z.infer<typeof reportDataSchema>

// 投放阈值验证
export const deliveryThresholdsSchema = z.object({
  minConsumption: z.number().min(0, '最低消耗阈值不能为负数'),
  maxCostPerLead: z.number().min(0, '最高咨询成本不能为负数'),
  checkStage1: z.number().min(0).default(60),
  checkStage2: z.number().min(0).default(120),
})

export type DeliveryThresholds = z.infer<typeof deliveryThresholdsSchema>

// 更新投放计划验证
export const updateCampaignSchema = z.object({
  budget: z.number().min(1).optional(),
  bidAmount: z.number().min(1).optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
})

export type UpdateCampaignSchema = z.infer<typeof updateCampaignSchema>
