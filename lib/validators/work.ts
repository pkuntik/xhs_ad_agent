/**
 * 作品数据验证 Schema (Zod)
 */
import { z } from 'zod'

// 作品状态枚举
export const workStatusSchema = z.enum([
  'draft',        // 草稿
  'generating',   // 生成中
  'published',    // 已发布
  'failed',       // 失败
])

export type WorkStatus = z.infer<typeof workStatusSchema>

// 作品类型枚举
export const workTypeSchema = z.enum([
  'image',        // 图文
  'video',        // 视频
])

export type WorkType = z.infer<typeof workTypeSchema>

// 创建作品输入验证
export const createWorkInputSchema = z.object({
  accountId: z.string().regex(/^[0-9a-fA-F]{24}$/, '无效的账号 ID'),
  title: z.string().min(1, '标题不能为空').max(100, '标题不能超过100字'),
  content: z.string().min(1, '内容不能为空'),
  type: workTypeSchema.default('image'),
  tags: z.array(z.string()).max(10, '标签不能超过10个').optional(),
  location: z.string().optional(),
})

export type CreateWorkInputSchema = z.infer<typeof createWorkInputSchema>

// 更新作品验证
export const updateWorkSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).max(10).optional(),
  location: z.string().optional(),
  status: workStatusSchema.optional(),
})

export type UpdateWorkSchema = z.infer<typeof updateWorkSchema>

// 笔记信息验证
export const noteInfoSchema = z.object({
  noteId: z.string().min(1, '笔记 ID 不能为空'),
  title: z.string().optional(),
  coverImage: z.string().url().optional(),
  noteType: z.number().min(0),
  authorName: z.string().optional(),
  publishedAt: z.date().or(z.string().transform(s => new Date(s))),
  reads: z.number().min(0).default(0),
  likes: z.number().min(0).default(0),
  comments: z.number().min(0).default(0),
  favorites: z.number().min(0).default(0),
  canHeat: z.boolean().default(false),
  cantHeatDesc: z.string().optional(),
  xsecToken: z.string().optional(),
})

export type NoteInfo = z.infer<typeof noteInfoSchema>

// 发布参数验证
export const publishParamsSchema = z.object({
  workId: z.string().regex(/^[0-9a-fA-F]{24}$/, '无效的作品 ID'),
  publicationIndex: z.number().min(0).default(0),
  scheduleTime: z.date().optional(),
})

export type PublishParams = z.infer<typeof publishParamsSchema>

// 图片信息验证
export const imageInfoSchema = z.object({
  url: z.string().url('无效的图片 URL'),
  width: z.number().min(1).optional(),
  height: z.number().min(1).optional(),
  size: z.number().min(0).optional(),
})

export type ImageInfo = z.infer<typeof imageInfoSchema>
