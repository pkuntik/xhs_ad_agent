import { xhsRequest } from '../client'
import type { ReportData } from '@/types/delivery-log'

// ============ 类型定义 ============

export interface OrderOverall {
  totalCost: number       // 总消耗（分）
  totalImpressions: number
  totalClicks: number
  totalConversions: number
}

export interface OrderItem {
  orderId: string
  noteId: string
  status: number
  cost: number
  impressions: number
  clicks: number
  conversions: number
}

export interface OrderListResponse {
  list: OrderItem[]
  total: number
}

export interface ReportRow {
  date?: string
  cost: number          // 消耗（分）
  impression: number
  click: number
  ctr?: number
  conversion?: number   // 转化数（私信咨询）
}

export interface ReportQueryResponse {
  list: ReportRow[]
}

export interface ReportParams {
  cookie: string
  advertiserId: string
  campaignId?: string
  unitId?: string
  startDate: Date
  endDate: Date
}

// ============ API 接口 ============

/**
 * 获取订单整体概览数据
 * GET /api/edith/chips/order/overall
 */
export async function getOrderOverall(params: {
  cookie: string
  startDate?: string    // YYYY-MM-DD
  endDate?: string
}): Promise<OrderOverall> {
  const { cookie, startDate, endDate } = params

  const queryParams: Record<string, string | number> = {}
  if (startDate) {
    queryParams.start_time = new Date(startDate).getTime()
  }
  if (endDate) {
    queryParams.end_time = new Date(endDate + ' 23:59:59').getTime()
  }

  return xhsRequest<OrderOverall>({
    cookie,
    method: 'GET',
    path: '/api/edith/chips/order/overall',
    params: queryParams,
  })
}

/**
 * 获取订单列表
 * POST /api/edith/chips/order/query
 */
export async function getOrderList(params: {
  cookie: string
  page?: number
  pageSize?: number
}): Promise<OrderListResponse> {
  const { cookie, page = 1, pageSize = 20 } = params

  return xhsRequest<OrderListResponse>({
    cookie,
    method: 'POST',
    path: '/api/edith/chips/order/query',
    body: {
      author_user_id: [],
      page,
      page_size: pageSize,
    },
  })
}

/**
 * 获取数据报表
 * POST /api/leona/report/query
 */
export async function getReportQuery(params: {
  cookie: string
  startDate: string     // YYYY-MM-DD
  endDate: string
  dimension?: 'day' | 'hour'
}): Promise<ReportQueryResponse> {
  const { cookie, startDate, endDate, dimension = 'day' } = params

  return xhsRequest<ReportQueryResponse>({
    cookie,
    method: 'POST',
    path: '/api/leona/report/query',
    body: {
      startTime: new Date(startDate).getTime(),
      endTime: new Date(endDate + ' 23:59:59').getTime(),
      dimension,
    },
  })
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * 获取投放数据报表（格式化输出）
 */
export async function getReportData(params: ReportParams): Promise<ReportData> {
  const { cookie, startDate, endDate } = params

  try {
    const report = await getReportQuery({
      cookie,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    })

    // 汇总数据
    const summary = (report.list || []).reduce(
      (acc, row) => {
        acc.spent += (row.cost || 0) / 100  // 分转元
        acc.impressions += row.impression || 0
        acc.clicks += row.click || 0
        acc.leads += row.conversion || 0
        return acc
      },
      { spent: 0, impressions: 0, clicks: 0, leads: 0 }
    )

    return {
      spent: summary.spent,
      impressions: summary.impressions,
      clicks: summary.clicks,
      ctr: summary.impressions > 0 ? summary.clicks / summary.impressions : 0,
      leads: summary.leads,
      costPerLead: summary.leads > 0 ? summary.spent / summary.leads : 0,
    }
  } catch (error) {
    console.error('获取报表数据失败:', error)
    // 返回空数据而不是抛出错误，让调用方能继续处理
    return {
      spent: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      leads: 0,
      costPerLead: 0,
    }
  }
}

/**
 * 获取实时数据（使用 overall 接口）
 */
export async function getRealTimeData(params: {
  cookie: string
  advertiserId: string
}): Promise<ReportData> {
  const today = formatDate(new Date())

  try {
    const overall = await getOrderOverall({
      cookie: params.cookie,
      startDate: today,
      endDate: today,
    })

    const spent = (overall.totalCost || 0) / 100
    const leads = overall.totalConversions || 0

    return {
      spent,
      impressions: overall.totalImpressions || 0,
      clicks: overall.totalClicks || 0,
      ctr: overall.totalImpressions > 0
        ? (overall.totalClicks || 0) / overall.totalImpressions
        : 0,
      leads,
      costPerLead: leads > 0 ? spent / leads : 0,
    }
  } catch (error) {
    console.error('获取实时数据失败:', error)
    return {
      spent: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      leads: 0,
      costPerLead: 0,
    }
  }
}

/**
 * 获取计划级别报表
 */
export async function getCampaignReport(params: {
  cookie: string
  advertiserId: string
  campaignId: string
  startDate: Date
  endDate: Date
}): Promise<ReportData> {
  // TODO: 如果有按计划筛选的接口，在这里实现
  return getReportData(params)
}

/**
 * 获取今日数据汇总
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
