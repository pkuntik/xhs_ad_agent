import type { NoteDetailResponse, NoteDetail, NoteComment } from '@/types/note'

const NOTE_DETAIL_API = 'https://justus-api.e-idear.com/crawler/api/v1/search/ad/note_detail_comment'

export interface FetchNoteDetailResult {
  success: boolean
  detail?: NoteDetail
  comments?: NoteComment[]
  error?: string
}

/**
 * 从小红书笔记URL中提取笔记ID
 */
export function extractNoteId(url: string): string | null {
  // 支持多种URL格式:
  // https://www.xiaohongshu.com/explore/690ed4e9000000000703b877
  // https://www.xiaohongshu.com/discovery/item/690ed4e9000000000703b877
  // https://xhslink.com/xxx (短链接需要先展开)
  const patterns = [
    /\/explore\/([a-f0-9]+)/i,
    /\/discovery\/item\/([a-f0-9]+)/i,
    /noteId=([a-f0-9]+)/i,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  // 如果URL本身就是纯ID
  if (/^[a-f0-9]{24}$/i.test(url.trim())) {
    return url.trim()
  }

  return null
}

/**
 * 获取笔记详情
 */
export async function fetchNoteDetail(noteId: string): Promise<FetchNoteDetailResult> {
  try {
    const response = await fetch(NOTE_DETAIL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ noteId }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `API请求失败: ${response.status} ${response.statusText}`,
      }
    }

    const data: NoteDetailResponse = await response.json()

    if (!data.success || data.code !== 200) {
      return {
        success: false,
        error: data.msg || '获取笔记详情失败',
      }
    }

    return {
      success: true,
      detail: data.data.detail,
      comments: data.data.comments,
    }
  } catch (error) {
    console.error('fetchNoteDetail error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
    }
  }
}

/**
 * 批量获取笔记详情
 */
export async function fetchMultipleNoteDetails(
  noteIds: string[]
): Promise<Map<string, FetchNoteDetailResult>> {
  const results = new Map<string, FetchNoteDetailResult>()

  // 并发请求，但限制并发数
  const batchSize = 5
  for (let i = 0; i < noteIds.length; i += batchSize) {
    const batch = noteIds.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (noteId) => {
        const result = await fetchNoteDetail(noteId)
        return { noteId, result }
      })
    )

    for (const { noteId, result } of batchResults) {
      results.set(noteId, result)
    }

    // 批次之间稍作延迟，避免触发限流
    if (i + batchSize < noteIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  return results
}
