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

/**
 * 创建投放计划
 * TODO: 需要抓包确认接口路径和参数
 * 可能的流程：
 * 1. POST /api/leona/campaign/create
 * 2. POST /api/leona/unit/create
 * 3. POST /api/leona/creative/create
 */
export async function createCampaign(
  _params: CreateCampaignParams
): Promise<CreateCampaignResult> {
  // TODO: 需要抓包确认创建投放计划的接口
  // 可能的流程：
  // 1. POST /api/leona/campaign/create - 创建计划
  // 2. POST /api/leona/unit/create - 创建单元
  // 3. POST /api/leona/creative/create - 创建创意
  throw new Error('createCampaign: 需要抓包创建投放计划的接口')
}

/**
 * 暂停投放计划
 * TODO: 需要抓包确认接口
 * 可能是 POST /api/leona/campaign/update 或 /api/leona/campaign/status
 */
export async function pauseCampaign(_params: {
  cookie: string
  campaignId: string
}): Promise<void> {
  throw new Error('pauseCampaign: 需要抓包暂停计划的接口')
}

/**
 * 恢复投放计划
 * TODO: 需要抓包确认接口
 */
export async function resumeCampaign(_params: {
  cookie: string
  campaignId: string
}): Promise<void> {
  throw new Error('resumeCampaign: 需要抓包恢复计划的接口')
}

/**
 * 更新投放预算
 * TODO: 需要抓包确认接口
 */
export async function updateBudget(_params: {
  cookie: string
  campaignId: string
  budget: number  // 元
}): Promise<void> {
  throw new Error('updateBudget: 需要抓包更新预算的接口')
}

/**
 * 更新出价
 * TODO: 需要抓包确认接口
 */
export async function updateBid(_params: {
  cookie: string
  unitId: string
  bidAmount: number  // 元
}): Promise<void> {
  throw new Error('updateBid: 需要抓包更新出价的接口')
}
