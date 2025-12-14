import { z } from 'zod'

export const campaignSchema = z.object({
  workId: z.string().min(1, '请选择作品'),
  budget: z.number().min(100, '预算最少100元').max(50000, '预算最多50000元').optional(),
  bidAmount: z.number().min(1, '出价最少1元').max(500, '出价最多500元').optional(),
  targeting: z.object({
    regions: z.array(z.string()).optional(),
    ages: z.array(z.string()).optional(),
    genders: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
  }).optional(),
})

export type CampaignFormData = z.infer<typeof campaignSchema>
