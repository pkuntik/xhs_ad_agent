import { z } from 'zod'

export const workSchema = z.object({
  accountId: z.string().min(1, '请选择账号'),
  noteId: z.string().min(1, '请输入笔记 ID'),
  title: z.string().min(1, '请输入标题').max(100, '标题不能超过100个字符'),
  content: z.string().max(5000, '内容不能超过5000个字符').optional(),
  coverUrl: z.string().url('请输入有效的 URL').optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
})

export type WorkFormData = z.infer<typeof workSchema>
