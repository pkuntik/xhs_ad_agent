import { xhsRequest } from '../client'
import type { CampaignTargeting } from '@/types/campaign'

// ============ 类型定义 ============

export interface XhsCampaign {
  campaignId: string
  campaignName: string
  status: number
  budget: number
  createTime: number
}

export interface XhsUnit {
  unitId: string
  unitName: string
  campaignId: string
  status: number
  bidAmount: number
}

export interface XhsCreative {
  creativeId: string
  unitId: string
  noteId: string
  status: number
}

export interface CampaignListResponse {
  list: XhsCampaign[]
  total: number
}

export interface UnitListResponse {
  list: XhsUnit[]
  total: number
}

export interface CreativeListResponse {
  list: XhsCreative[]
  total: number
}

export interface CreateCampaignParams {
  cookie: string
  advertiserId: string
  noteId: string
  budget: number          // 预算（元）
  bidAmount: number       // 出价（元）
  objective?: string      // 投放目标，默认私信咨询
  targeting?: CampaignTargeting
}

export interface CreateCampaignResult {
  campaignId: string      // 计划 ID
  unitId: string          // 单元 ID
  creativeId?: string     // 创意 ID
}

// ============ 薯条投放类型定义 ============

// 投放目标
export enum ChipsAdvertiseTarget {
  IMPRESSIONS = 1,      // 曝光量
  ENGAGEMENT = 2,       // 互动量
  FOLLOWERS = 3,        // 粉丝关注
  PRIVATE_MESSAGE = 4,  // 私信咨询
}

// 性别定向
export enum ChipsGender {
  FEMALE = '1',
  MALE = '2',
}

// 薯条订单参数
export interface ChipsOrderParams {
  noteId: string                         // 笔记ID
  advertiseTarget: ChipsAdvertiseTarget  // 投放目标
  budget: number                         // 预算（分），如 7500=75元
  totalTime: number                      // 投放时长（秒），如 21600=6小时
  planStartTime?: number                 // 计划开始时间，0=立即开始
  smartTarget?: number                   // 智能定向，0=关闭
  targetAge?: string[]                   // 年龄定向，如 ["24-30", "31-40"]
  targetGender?: ChipsGender[]           // 性别定向
  targetCity?: string[]                  // 城市定向
  targetInterest?: string[]              // 兴趣定向
  convCntMax?: number                    // 预计转化上限
  convCntMin?: number                    // 预计转化下限
  couponOids?: string[]                  // 优惠券ID
}

// 批量创建订单请求体
interface ChipsOrderRequestBody {
  idx: number
  note_id: string
  advertise_target: number
  plan_start_time: number
  total_time: number
  campaign_budget: number
  coupon_oids: string[]
  smart_target: number
  target_age: string[]
  target_gender: string[]
  target_city: string[]
  target_interest: string[]
  conv_cnt_max?: number
  conv_cnt_min?: number
}

// 创建订单成功详情
export interface ChipsOrderDetail {
  success: boolean
  order_no: string
  note_id: string
  actual_pay: number  // 实际支付（分）
  idx: number
  error_msg?: string
}

// 批量创建订单响应
export interface ChipsBatchCreateResponse {
  success_count: number
  failed_count: number
  details: ChipsOrderDetail[]
}

// 创建薯条订单结果
export interface CreateChipsOrderResult {
  success: boolean
  orderNo?: string
  noteId: string
  actualPay?: number  // 实际支付（分）
  error?: string
}

// ============ 已实现的 API 接口 ============

/**
 * 获取计划列表
 * POST /api/leona/campaign/list
 */
export async function getCampaignList(params: {
  cookie: string
  advertiserId?: string
  page?: number
  pageSize?: number
}): Promise<CampaignListResponse> {
  const { cookie, page = 1, pageSize = 20 } = params

  return xhsRequest<CampaignListResponse>({
    cookie,
    method: 'POST',
    path: '/api/leona/campaign/list',
    body: {
      pageNum: page,
      pageSize: pageSize,
    },
  })
}

/**
 * 获取单元列表
 * POST /api/leona/unit/list
 */
export async function getUnitList(params: {
  cookie: string
  campaignId: string
  page?: number
  pageSize?: number
}): Promise<UnitListResponse> {
  const { cookie, campaignId, page = 1, pageSize = 20 } = params

  return xhsRequest<UnitListResponse>({
    cookie,
    method: 'POST',
    path: '/api/leona/unit/list',
    body: {
      campaignId,
      pageNum: page,
      pageSize: pageSize,
    },
  })
}

/**
 * 获取创意列表
 * POST /api/leona/creative/list
 */
export async function getCreativeList(params: {
  cookie: string
  unitId: string
  page?: number
  pageSize?: number
}): Promise<CreativeListResponse> {
  const { cookie, unitId, page = 1, pageSize = 20 } = params

  return xhsRequest<CreativeListResponse>({
    cookie,
    method: 'POST',
    path: '/api/leona/creative/list',
    body: {
      unitId,
      pageNum: page,
      pageSize: pageSize,
    },
  })
}

/**
 * 获取计划详情
 */
export async function getCampaignDetail(params: {
  cookie: string
  campaignId: string
}): Promise<XhsCampaign | null> {
  const { cookie, campaignId } = params
  const result = await getCampaignList({ cookie, pageSize: 100 })
  return result.list.find(c => c.campaignId === campaignId) || null
}

// ============ 待实现的接口（需要抓包） ============
// 注意：以下接口当前返回模拟数据，需要抓包后实现真实 API 调用

/**
 * 创建投放计划
 *
 * TODO: 需要抓包确认接口路径和参数
 * 可能的流程：
 * 1. POST /api/leona/campaign/create
 * 2. POST /api/leona/unit/create
 * 3. POST /api/leona/creative/create
 *
 * @returns 模拟的投放计划创建结果
 */
export async function createCampaign(
  _params: CreateCampaignParams
): Promise<CreateCampaignResult> {
  console.warn('[API 模拟] createCampaign: 接口未实现，返回模拟数据')

  // 返回模拟数据以便开发测试
  const mockCampaignId = `mock_campaign_${Date.now()}`
  const mockUnitId = `mock_unit_${Date.now()}`

  return {
    campaignId: mockCampaignId,
    unitId: mockUnitId,
  }
}

/**
 * 暂停投放计划
 *
 * TODO: 需要抓包确认接口
 * 可能是 POST /api/leona/campaign/update 或 /api/leona/campaign/status
 */
export async function pauseCampaign(_params: {
  cookie: string
  campaignId: string
}): Promise<void> {
  console.warn('[API 模拟] pauseCampaign: 接口未实现，操作已跳过')
  // 静默返回，不阻塞流程
}

/**
 * 恢复投放计划
 *
 * TODO: 需要抓包确认接口
 */
export async function resumeCampaign(_params: {
  cookie: string
  campaignId: string
}): Promise<void> {
  console.warn('[API 模拟] resumeCampaign: 接口未实现，操作已跳过')
  // 静默返回，不阻塞流程
}

/**
 * 更新投放预算
 *
 * TODO: 需要抓包确认接口
 */
export async function updateBudget(_params: {
  cookie: string
  campaignId: string
  budget: number  // 元
}): Promise<void> {
  console.warn('[API 模拟] updateBudget: 接口未实现，操作已跳过')
  // 静默返回，不阻塞流程
}

/**
 * 更新出价
 *
 * TODO: 需要抓包确认接口
 */
export async function updateBid(_params: {
  cookie: string
  unitId: string
  bidAmount: number  // 元
}): Promise<void> {
  console.warn('[API 模拟] updateBid: 接口未实现，操作已跳过')
  // 静默返回，不阻塞流程
}

// ============ 薯条投放 API ============

/**
 * 创建薯条投放订单
 * POST /api/edith/chips/order/batch_create
 */
export async function createChipsOrder(params: {
  cookie: string
  order: ChipsOrderParams
  payChannel?: number  // 支付渠道，1=余额
}): Promise<CreateChipsOrderResult> {
  const { cookie, order, payChannel = 1 } = params

  const requestBody: ChipsOrderRequestBody = {
    idx: 1,
    note_id: order.noteId,
    advertise_target: order.advertiseTarget,
    plan_start_time: order.planStartTime ?? 0,
    total_time: order.totalTime,
    campaign_budget: order.budget,
    coupon_oids: order.couponOids ?? [],
    smart_target: order.smartTarget ?? 0,
    target_age: order.targetAge ?? [],
    target_gender: order.targetGender ?? [],
    target_city: order.targetCity ?? [],
    target_interest: order.targetInterest ?? [],
  }

  if (order.convCntMax !== undefined) {
    requestBody.conv_cnt_max = order.convCntMax
  }
  if (order.convCntMin !== undefined) {
    requestBody.conv_cnt_min = order.convCntMin
  }

  const response = await xhsRequest<ChipsBatchCreateResponse>({
    cookie,
    method: 'POST',
    path: '/api/edith/chips/order/batch_create',
    body: {
      orders: [requestBody],
      pay_channel: payChannel,
    },
    headers: {
      'Referer': 'https://ad.xiaohongshu.com/microapp/kbt/chips/create',
      'xsecappid': 'kbt',
    },
  })

  const detail = response.details[0]
  if (detail?.success) {
    return {
      success: true,
      orderNo: detail.order_no,
      noteId: detail.note_id,
      actualPay: detail.actual_pay,
    }
  }

  return {
    success: false,
    noteId: order.noteId,
    error: detail?.error_msg || '创建订单失败',
  }
}

/**
 * 批量创建薯条投放订单
 * POST /api/edith/chips/order/batch_create
 */
export async function createChipsOrderBatch(params: {
  cookie: string
  orders: ChipsOrderParams[]
  payChannel?: number
}): Promise<CreateChipsOrderResult[]> {
  const { cookie, orders, payChannel = 1 } = params

  const requestBodies: ChipsOrderRequestBody[] = orders.map((order, idx) => {
    const body: ChipsOrderRequestBody = {
      idx: idx + 1,
      note_id: order.noteId,
      advertise_target: order.advertiseTarget,
      plan_start_time: order.planStartTime ?? 0,
      total_time: order.totalTime,
      campaign_budget: order.budget,
      coupon_oids: order.couponOids ?? [],
      smart_target: order.smartTarget ?? 0,
      target_age: order.targetAge ?? [],
      target_gender: order.targetGender ?? [],
      target_city: order.targetCity ?? [],
      target_interest: order.targetInterest ?? [],
    }
    if (order.convCntMax !== undefined) {
      body.conv_cnt_max = order.convCntMax
    }
    if (order.convCntMin !== undefined) {
      body.conv_cnt_min = order.convCntMin
    }
    return body
  })

  const response = await xhsRequest<ChipsBatchCreateResponse>({
    cookie,
    method: 'POST',
    path: '/api/edith/chips/order/batch_create',
    body: {
      orders: requestBodies,
      pay_channel: payChannel,
    },
    headers: {
      'Referer': 'https://ad.xiaohongshu.com/microapp/kbt/chips/create',
      'xsecappid': 'kbt',
    },
  })

  return response.details.map(detail => ({
    success: detail.success,
    orderNo: detail.order_no,
    noteId: detail.note_id,
    actualPay: detail.actual_pay,
    error: detail.error_msg,
  }))
}

/**
 * 取消薯条投放订单
 * POST /api/edith/chips/order/cancel
 */
export async function cancelChipsOrder(params: {
  cookie: string
  orderNo: string
}): Promise<{ success: boolean; error?: string }> {
  const { cookie, orderNo } = params

  try {
    await xhsRequest({
      cookie,
      method: 'POST',
      path: '/api/edith/chips/order/cancel',
      body: {
        order_no: orderNo,
      },
      headers: {
        'Referer': 'https://ad.xiaohongshu.com/microapp/kbt/chips/order_manage',
        'xsecappid': 'kbt',
      },
    })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '取消订单失败',
    }
  }
}
