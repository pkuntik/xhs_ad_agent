import { ObjectId } from 'mongodb'

export type TransactionType = 'recharge' | 'consume' | 'refund'

export type BillingAction =
  | 'ai_generate_title'           // 生成标题
  | 'ai_generate_content'         // 生成正文
  | 'ai_generate_cover_plan'      // 生成封面规划
  | 'ai_generate_images_plan'     // 生成配图规划
  | 'ai_generate_comments'        // 生成评论
  | 'ai_generate_topics'          // 生成话题
  | 'ai_generate_private_message' // 生成私信模板
  | 'ai_generate_full'            // 一次性完整生成
  | 'image_generate'              // 生成图片
  | 'publish_scan'                // 扫码发布
  | 'account_add'                 // 添加账号(超额)
  | 'xhs_api_call'                // 小红书API调用

export interface Transaction {
  _id: ObjectId
  userId: ObjectId               // 用户ID
  type: TransactionType          // 类型
  action?: BillingAction         // 扣费动作(consume时)
  amount: number                 // 金额(分), 充值为正, 消费为负
  balanceBefore: number          // 操作前余额
  balanceAfter: number           // 操作后余额

  // 关联信息
  relatedId?: ObjectId           // 关联对象ID(workId等)
  relatedType?: string           // 关联类型 (work/account等)

  // 充值相关
  rechargeBy?: ObjectId          // 充值操作人(管理员)
  rechargeNote?: string          // 充值备注

  // 元数据
  metadata?: Record<string, unknown>
  description: string            // 描述

  createdAt: Date
}

export interface TransactionFilter {
  userId?: string
  type?: TransactionType
  action?: BillingAction
  startDate?: Date
  endDate?: Date
}

export interface TransactionSummary {
  totalRecharge: number
  totalConsume: number
  totalRefund: number
  balance: number
}
