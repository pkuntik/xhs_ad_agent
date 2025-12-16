import { ObjectId } from 'mongodb'
import type { BillingAction } from './transaction'

export interface PricingItem {
  _id: ObjectId
  action: BillingAction          // 计费动作
  name: string                   // 显示名称
  description: string            // 描述
  price: number                  // 单价(分)
  enabled: boolean               // 是否启用
  sortOrder: number              // 排序
  createdAt: Date
  updatedAt: Date
}

export interface UpdatePricingInput {
  price?: number
  enabled?: boolean
  description?: string
}

// 默认价格配置 (单位: 分)
export const DEFAULT_PRICING: Record<BillingAction, { name: string; description: string; price: number }> = {
  ai_generate_title: {
    name: '生成标题',
    description: 'AI生成笔记标题',
    price: 50,  // 0.5元
  },
  ai_generate_content: {
    name: '生成正文',
    description: 'AI生成笔记正文内容',
    price: 100, // 1元
  },
  ai_generate_cover_plan: {
    name: '生成封面规划',
    description: 'AI生成封面设计规划',
    price: 50,  // 0.5元
  },
  ai_generate_images_plan: {
    name: '生成配图规划',
    description: 'AI生成配图设计规划',
    price: 50,  // 0.5元
  },
  ai_generate_comments: {
    name: '生成评论',
    description: 'AI生成置顶评论和问答',
    price: 30,  // 0.3元
  },
  ai_generate_topics: {
    name: '生成话题',
    description: 'AI生成推荐话题标签',
    price: 20,  // 0.2元
  },
  ai_generate_private_message: {
    name: '生成私信模板',
    description: 'AI生成私信话术模板',
    price: 30,  // 0.3元
  },
  ai_generate_full: {
    name: '完整AI生成',
    description: '一次性生成所有内容(标题、正文、封面、配图等)',
    price: 300, // 3元
  },
  ai_regenerate_plan: {
    name: '重新生成规划',
    description: 'AI重新生成封面或配图规划',
    price: 50,  // 0.5元
  },
  image_generate: {
    name: '生成图片',
    description: '生成封面或配图图片',
    price: 100, // 1元
  },
  publish_scan: {
    name: '扫码发布',
    description: '扫码发布笔记到小红书',
    price: 50,  // 0.5元
  },
  account_add: {
    name: '添加账号(超额)',
    description: '超出免费额度后添加小红书账号',
    price: 500, // 5元
  },
  xhs_api_call: {
    name: '小红书API调用',
    description: '调用小红书聚光API(投放等)',
    price: 10,  // 0.1元
  },
}

// 格式化价格显示
export function formatPrice(priceInCents: number): string {
  return `¥${(priceInCents / 100).toFixed(2)}`
}

// 格式化余额显示
export function formatBalance(balanceInCents: number): string {
  return `¥${(balanceInCents / 100).toFixed(2)}`
}
