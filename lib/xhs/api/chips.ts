import { xhsRequest } from '../client'
import type { ChipsOrderItem, QueryOrdersParams, QueryOrdersResponse } from '@/types/order'

// ============ 类型定义 ============

// 薯币钱包余额响应
export interface ChipsWalletBalance {
  redcoin: number           // 薯币余额
  chips_cash: number        // 薯条现金
  chips_wallet: number      // 薯条钱包
  chips_wallet_cash: number // 薯条钱包现金
  chips_wallet_return: number // 薯条钱包返还
  coupon_info: {
    valid_count: number
    summary: unknown[]
  }
}

// 笔记列表项（聚光平台返回的格式）
export interface ChipsNoteItem {
  note_id: string
  note_title: string
  note_image: string
  note_type: number          // 1=图文, 2=视频
  create_time: number        // 时间戳（毫秒）
  author_name: string
  read: number               // 阅读数
  likes: number              // 点赞数
  comments: number           // 评论数
  favorite: number           // 收藏数
  can_heat: boolean          // 是否可以加热推广
  cant_heat_desc?: string    // 不可加热的原因描述
  xsec_token: string         // 安全令牌
}

// 查询笔记列表参数
export interface QueryNotesParams {
  page?: number
  pageSize?: number
  listType?: number          // 3=全部笔记
  userId?: string            // 筛选作者
  noteId?: string            // 筛选笔记ID
  sortColumn?: 'createTime' | 'likes' | 'read'
  sortOrder?: 'asc' | 'desc'
}

// 笔记列表响应
export interface QueryNotesResponse {
  list: ChipsNoteItem[]
  total: number
  invalid_count: number
}

// ============ API 接口 ============

/**
 * 获取账号笔记列表（聚光平台）
 * GET /api/edith/chips/note/query_note
 */
export async function queryChipsNotes(
  cookie: string,
  params: QueryNotesParams = {}
): Promise<QueryNotesResponse> {
  const {
    page = 1,
    pageSize = 10,
    listType = 3,
    userId = '',
    noteId = '',
    sortColumn = 'createTime',
    sortOrder = 'desc',
  } = params

  const data = await xhsRequest<QueryNotesResponse>({
    cookie,
    method: 'GET',
    path: '/api/edith/chips/note/query_note',
    params: {
      page,
      page_size: pageSize,
      list_type: listType,
      user_id: userId,
      note_id: noteId,
      sort_column: sortColumn,
      sort_order: sortOrder,
    },
  })

  return {
    list: data.list || [],
    total: data.total || 0,
    invalid_count: data.invalid_count || 0,
  }
}

/**
 * 获取订单列表（聚光平台）
 * POST /api/edith/chips/order/query
 */
export async function queryChipsOrders(
  cookie: string,
  params: QueryOrdersParams = {}
): Promise<QueryOrdersResponse> {
  const {
    author_user_id = [],
    page = 1,
    page_size = 10,
  } = params

  const data = await xhsRequest<QueryOrdersResponse>({
    cookie,
    method: 'POST',
    path: '/api/edith/chips/order/query',
    body: {
      author_user_id,
      page,
      page_size,
    },
  })

  return {
    list: data.list || [],
    total: data.total || 0,
  }
}

/**
 * 获取薯币钱包余额
 * GET /api/edith/chips/wallet/balance
 */
export async function getChipsWalletBalance(cookie: string): Promise<ChipsWalletBalance> {
  const data = await xhsRequest<ChipsWalletBalance>({
    cookie,
    method: 'GET',
    path: '/api/edith/chips/wallet/balance',
  })

  return {
    redcoin: data.redcoin || 0,
    chips_cash: data.chips_cash || 0,
    chips_wallet: data.chips_wallet || 0,
    chips_wallet_cash: data.chips_wallet_cash || 0,
    chips_wallet_return: data.chips_wallet_return || 0,
    coupon_info: data.coupon_info || { valid_count: 0, summary: [] },
  }
}

export type { ChipsOrderItem, QueryOrdersParams, QueryOrdersResponse }
