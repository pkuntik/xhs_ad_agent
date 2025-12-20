import { ObjectId } from 'mongodb'

// 订单状态
export type OrderState = 1 | 2 | 3 | 4 | 5
// 1: 投放中, 2: 已结束(审核拒绝), 3: 审核中, 4: 已退款, 5: 已暂停

// 推广目标
export type AdvertiseTarget = 1 | 2 | 3 | 4 | 5
// 1: 笔记阅读量, 2: 点赞收藏量, 3: 粉丝关注量, 4: 主页浏览量, 5: 私信咨询量

// 订单中的笔记信息
export interface OrderNote {
  note_id: string
  note_title: string
  note_image: string
  note_type: 'normal' | 'video'
  author_id: string
  author_name: string
  author_image: string
  create_time: number
  can_heat: boolean
  cant_heat_desc?: string
  xsec_token?: string
}

// 定向信息
export interface TargetInfo {
  target_gender: string[]
  target_age: string[]
  target_city: string[]
  target_interest: string[]
}

// API 返回的订单
export interface ChipsOrderItem {
  order_no: string
  state: OrderState
  state_desc: string
  create_time: number
  plan_start_time: number
  end_time: number
  total_time: number

  // 预算与消耗
  campaign_budget: number       // 预算（分）
  actual_pay: number            // 实际支付（分）
  actual_refund: number         // 实际退款（分）
  consume?: number              // 消耗（分）
  total_discount: number        // 折扣

  // 效果数据
  impression?: number           // 展现
  read?: number                 // 阅读
  likes?: number                // 点赞
  comments?: number             // 评论
  favorite?: number             // 收藏
  follow?: number               // 关注
  homepage_view?: number        // 主页浏览
  cpa?: number                  // 每次转化成本（分）
  conv_cnt_min: number          // 预估转化最小值
  conv_cnt_max: number          // 预估转化最大值

  // 推广设置
  advertise_target: AdvertiseTarget
  advertise_target_desc: string
  smart_target: number
  gift_mode: number
  multi_note: number

  // 定向设置
  target_gender: string[]
  target_age: string[]
  target_city: string[]
  target_interest: string[]
  target_info: TargetInfo

  // 笔记信息
  notes: OrderNote[]
  can_heat: boolean
  cant_heat_desc?: string

  // 支付信息
  pay_channel: number
  pay_channel_desc: string
  discount_mode: string
  discount_info: string
}

// 订单查询参数
export interface QueryOrdersParams {
  author_user_id?: string[]
  page?: number
  page_size?: number
}

// 订单查询响应
export interface QueryOrdersResponse {
  list: ChipsOrderItem[]
  total: number
}

// 数据库存储的订单
export interface Order {
  _id: ObjectId
  accountId: ObjectId           // 关联账号
  orderNo: string               // 订单号
  state: OrderState
  stateDesc: string

  // 时间
  createTime: Date
  planStartTime: Date
  endTime: Date
  totalTime: number

  // 预算与消耗
  campaignBudget: number
  actualPay: number
  actualRefund: number
  consume: number
  totalDiscount: number

  // 效果数据
  impression: number
  read: number
  likes: number
  comments: number
  favorite: number
  follow: number
  homepageView: number
  cpa: number
  convCntMin: number
  convCntMax: number

  // 推广设置
  advertiseTarget: AdvertiseTarget
  advertiseTargetDesc: string
  smartTarget: number
  giftMode: number
  multiNote: number

  // 定向设置
  targetInfo: TargetInfo

  // 笔记信息
  notes: OrderNote[]
  canHeat: boolean
  cantHeatDesc?: string

  // 支付信息
  payChannel: number
  payChannelDesc: string
  discountMode: string
  discountInfo: string

  // 同步信息
  syncedAt: Date
  updatedAt: Date
}

// 订单列表项（用于前端展示）
export interface OrderListItem {
  _id: string
  orderNo: string
  state: OrderState
  stateDesc: string
  createTime: string
  planStartTime: string
  endTime: string

  // 预算与消耗（元）
  campaignBudget: number
  actualPay: number
  actualRefund: number
  consume: number

  // 效果数据
  impression: number
  read: number
  likes: number
  comments: number
  favorite: number
  follow: number
  homepageView: number
  cpa: number

  // 推广设置
  advertiseTargetDesc: string

  // 笔记信息
  notes: OrderNote[]
  canHeat: boolean
  cantHeatDesc?: string
}
