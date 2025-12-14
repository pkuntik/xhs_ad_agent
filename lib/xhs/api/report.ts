import { xhsRequest } from '../client'
import type { ReportData } from '@/types/delivery-log'

export interface ReportParams {
  cookie: string
  advertiserId: string
  campaignId?: string
  unitId?: string
  startDate: Date
  endDate: Date
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * 获取投放数据报表
 *
 * TODO: 根据抓包数据实现
 * 预期返回：消耗、展现、点击、咨询等数据
 */
export async function getReportData(params: ReportParams): Promise<ReportData> {
  const { cookie, advertiserId, campaignId, startDate, endDate } = params

  // TODO: 替换为实际接口
  // const data = await xhsRequest({
  //   cookie,
  //   method: 'POST',
  //   path: '/api/gw/advertiser/report/query',
  //   body: {
  //     advertiserId,
  //     campaignIds: campaignId ? [campaignId] : undefined,
  //     startDate: formatDate(startDate),
  //     endDate: formatDate(endDate),
  //     metrics: [
  //       'cost',           // 消耗
  //       'impression',     // 展现
  //       'click',          // 点击
  //       'ctr',            // 点击率
  //       'lead_count',     // 私信咨询数
  //       'lead_cost',      // 单次咨询成本
  //     ],
  //   },
  // })
  //
  // 汇总数据
  // const summary = data.rows?.reduce((acc, row) => {
  //   acc.spent += row.cost / 100
  //   acc.impressions += row.impression
  //   acc.clicks += row.click
  //   acc.leads += row.lead_count
  //   return acc
  // }, { spent: 0, impressions: 0, clicks: 0, leads: 0 })
  //
  // return {
  //   spent: summary?.spent || 0,
  //   impressions: summary?.impressions || 0,
  //   clicks: summary?.clicks || 0,
  //   ctr: summary?.impressions > 0 ? summary.clicks / summary.impressions : 0,
  //   leads: summary?.leads || 0,
  //   costPerLead: summary?.leads > 0 ? summary.spent / summary.leads : 0,
  // }

  throw new Error('getReportData: 接口待实现，请提供抓包数据')
}

/**
 * 获取实时数据
 *
 * TODO: 根据抓包数据实现
 */
export async function getRealTimeData(params: {
  cookie: string
  advertiserId: string
}): Promise<ReportData> {
  // TODO: 替换为实际接口
  // return xhsRequest({
  //   cookie: params.cookie,
  //   path: `/api/gw/advertiser/report/realtime?advertiserId=${params.advertiserId}`,
  // })

  throw new Error('getRealTimeData: 接口待实现，请提供抓包数据')
}

/**
 * 获取计划级别报表
 *
 * TODO: 根据抓包数据实现
 */
export async function getCampaignReport(params: {
  cookie: string
  advertiserId: string
  campaignId: string
  startDate: Date
  endDate: Date
}): Promise<ReportData> {
  return getReportData({
    ...params,
  })
}

/**
 * 获取今日数据汇总
 *
 * TODO: 根据抓包数据实现
 */
export async function getTodaySummary(params: {
  cookie: string
  advertiserId: string
}): Promise<ReportData> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return getReportData({
    cookie: params.cookie,
    advertiserId: params.advertiserId,
    startDate: today,
    endDate: new Date(),
  })
}
