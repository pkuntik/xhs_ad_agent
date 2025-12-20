import { xhsRequest } from '../client'

// ============ 类型定义 ============

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
