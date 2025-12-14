import { ObjectId } from 'mongodb'

// 决策类型
export type DeliveryDecision = 'continue' | 'pause' | 'restart' | 'switch_work'

// 投放记录
export interface DeliveryLog {
  _id: ObjectId
  accountId: ObjectId
  workId: ObjectId
  campaignId: ObjectId

  // 时间区间
  periodStart: Date
  periodEnd: Date

  // 消耗数据
  spent: number                   // 消耗金额
  impressions: number             // 展现数
  clicks: number                  // 点击数
  ctr: number                     // 点击率

  // 转化数据
  leads: number                   // 私信咨询数
  costPerLead: number             // 单次咨询成本
  conversionRate: number          // 转化率

  // 效果判定
  isEffective: boolean            // 是否有效
  decision: DeliveryDecision      // 决策
  decisionReason: string          // 决策原因

  createdAt: Date
}

// 报表数据
export interface ReportData {
  spent: number                   // 消耗 (元)
  impressions: number             // 展现数
  clicks: number                  // 点击数
  ctr: number                     // 点击率
  leads: number                   // 私信咨询数
  costPerLead: number             // 单次咨询成本
}
