/**
 * 账号数据验证 Schema (Zod)
 */
import { z } from 'zod'

// Cookie 验证
export const cookieSchema = z.string().min(10, 'Cookie 不能为空或过短')

// 创建账号输入验证
export const createAccountInputSchema = z.object({
  name: z.string().optional(),
  cookie: cookieSchema,
  dailyBudget: z.number().min(0).default(5000),
  defaultBidAmount: z.number().min(1).default(30),
  thresholds: z.object({
    minConsumption: z.number().min(0).default(100),
    maxCostPerLead: z.number().min(0).default(50),
    maxFailRetries: z.number().min(0).max(10).default(3),
  }).optional(),
})

export type CreateAccountInputSchema = z.infer<typeof createAccountInputSchema>

// 账号密码登录验证
export const passwordLoginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码长度至少6位'),
})

export type PasswordLoginSchema = z.infer<typeof passwordLoginSchema>

// 创建账号（密码方式）验证
export const createAccountByPasswordInputSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码长度至少6位'),
  dailyBudget: z.number().min(0).default(5000),
  defaultBidAmount: z.number().min(1).default(30),
  thresholds: z.object({
    minConsumption: z.number().min(0).default(100),
    maxCostPerLead: z.number().min(0).default(50),
    maxFailRetries: z.number().min(0).max(10).default(3),
  }).optional(),
})

export type CreateAccountByPasswordInputSchema = z.infer<typeof createAccountByPasswordInputSchema>

// 账号阈值验证
export const accountThresholdsSchema = z.object({
  minConsumption: z.number().min(0, '最低消耗不能为负数'),
  maxCostPerLead: z.number().min(0, '最高成本不能为负数'),
  maxFailRetries: z.number().min(0).max(10, '重试次数不能超过10'),
})

export type AccountThresholdsSchema = z.infer<typeof accountThresholdsSchema>

// 更新账号验证
export const updateAccountSchema = z.object({
  name: z.string().min(1, '账号名称不能为空').optional(),
  dailyBudget: z.number().min(0).optional(),
  defaultBidAmount: z.number().min(1).optional(),
})

export type UpdateAccountSchema = z.infer<typeof updateAccountSchema>

// MongoDB ObjectId 验证
export const objectIdSchema = z.string().regex(
  /^[0-9a-fA-F]{24}$/,
  '无效的 ID 格式'
)
