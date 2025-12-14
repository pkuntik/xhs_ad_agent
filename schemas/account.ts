// Zod 验证 schemas
import { z } from 'zod'

export const accountSchema = z.object({
  name: z.string().min(1, '请输入账号名称').max(50, '名称不能超过50个字符'),
  cookie: z.string().min(10, 'Cookie 格式不正确'),
  dailyBudget: z.number().min(100, '每日预算最少100元').max(100000, '每日预算最多100000元').optional(),
  defaultBidAmount: z.number().min(1, '出价最少1元').max(1000, '出价最多1000元').optional(),
})

export const accountThresholdsSchema = z.object({
  minConsumption: z.number().min(10).max(1000),
  maxCostPerLead: z.number().min(1).max(500),
  maxFailRetries: z.number().min(1).max(10),
})

export type AccountFormData = z.infer<typeof accountSchema>
export type AccountThresholdsFormData = z.infer<typeof accountThresholdsSchema>
