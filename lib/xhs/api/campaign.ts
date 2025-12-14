import { xhsRequest } from '../client'
import type { CampaignTargeting } from '@/types/campaign'

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

/**
 * 创建投放计划
 *
 * TODO: 根据抓包数据实现
 * 预期流程：
 * 1. 创建计划 (Campaign)
 * 2. 创建单元 (Unit/AdGroup)
 * 3. 绑定创意 (Creative/笔记)
 */
export async function createCampaign(
  params: CreateCampaignParams
): Promise<CreateCampaignResult> {
  const { cookie, advertiserId, noteId, budget, bidAmount, targeting } = params

  // TODO: 替换为实际接口
  // Step 1: 创建计划
  // const campaignData = await xhsRequest({
  //   cookie,
  //   method: 'POST',
  //   path: '/api/gw/advertiser/campaign/create',
  //   body: {
  //     advertiserId,
  //     name: `自动投放计划_${Date.now()}`,
  //     objective: 'LEAD_COLLECTION',
  //     dailyBudget: budget * 100, // 元转分
  //     status: 'ACTIVE',
  //   },
  // })
  //
  // Step 2: 创建单元
  // const unitData = await xhsRequest({
  //   cookie,
  //   method: 'POST',
  //   path: '/api/gw/advertiser/unit/create',
  //   body: {
  //     campaignId: campaignData.campaignId,
  //     name: `自动投放单元_${Date.now()}`,
  //     bidAmount: bidAmount * 100,
  //     bidStrategy: 'OCPM',
  //     targeting: targeting || {},
  //   },
  // })
  //
  // Step 3: 绑定创意
  // await xhsRequest({
  //   cookie,
  //   method: 'POST',
  //   path: '/api/gw/advertiser/creative/bind',
  //   body: {
  //     unitId: unitData.unitId,
  //     noteId,
  //     creativeType: 'NOTE',
  //   },
  // })
  //
  // return {
  //   campaignId: campaignData.campaignId,
  //   unitId: unitData.unitId,
  // }

  throw new Error('createCampaign: 接口待实现，请提供抓包数据')
}

/**
 * 暂停投放计划
 *
 * TODO: 根据抓包数据实现
 */
export async function pauseCampaign(params: {
  cookie: string
  campaignId: string
}): Promise<void> {
  // TODO: 替换为实际接口
  // await xhsRequest({
  //   cookie: params.cookie,
  //   method: 'POST',
  //   path: '/api/gw/advertiser/campaign/status/update',
  //   body: {
  //     campaignId: params.campaignId,
  //     status: 'PAUSED',
  //   },
  // })

  throw new Error('pauseCampaign: 接口待实现，请提供抓包数据')
}

/**
 * 恢复投放计划
 *
 * TODO: 根据抓包数据实现
 */
export async function resumeCampaign(params: {
  cookie: string
  campaignId: string
}): Promise<void> {
  // TODO: 替换为实际接口
  // await xhsRequest({
  //   cookie: params.cookie,
  //   method: 'POST',
  //   path: '/api/gw/advertiser/campaign/status/update',
  //   body: {
  //     campaignId: params.campaignId,
  //     status: 'ACTIVE',
  //   },
  // })

  throw new Error('resumeCampaign: 接口待实现，请提供抓包数据')
}

/**
 * 更新投放预算
 *
 * TODO: 根据抓包数据实现
 */
export async function updateBudget(params: {
  cookie: string
  campaignId: string
  budget: number  // 元
}): Promise<void> {
  // TODO: 替换为实际接口
  // await xhsRequest({
  //   cookie: params.cookie,
  //   method: 'POST',
  //   path: '/api/gw/advertiser/campaign/budget/update',
  //   body: {
  //     campaignId: params.campaignId,
  //     dailyBudget: params.budget * 100,
  //   },
  // })

  throw new Error('updateBudget: 接口待实现，请提供抓包数据')
}

/**
 * 更新出价
 *
 * TODO: 根据抓包数据实现
 */
export async function updateBid(params: {
  cookie: string
  unitId: string
  bidAmount: number  // 元
}): Promise<void> {
  // TODO: 替换为实际接口

  throw new Error('updateBid: 接口待实现，请提供抓包数据')
}

/**
 * 获取计划详情
 *
 * TODO: 根据抓包数据实现
 */
export async function getCampaignDetail(params: {
  cookie: string
  campaignId: string
}): Promise<unknown> {
  // TODO: 替换为实际接口

  throw new Error('getCampaignDetail: 接口待实现，请提供抓包数据')
}

/**
 * 获取计划列表
 *
 * TODO: 根据抓包数据实现
 */
export async function getCampaignList(params: {
  cookie: string
  advertiserId: string
  page?: number
  pageSize?: number
}): Promise<unknown[]> {
  // TODO: 替换为实际接口

  throw new Error('getCampaignList: 接口待实现，请提供抓包数据')
}
