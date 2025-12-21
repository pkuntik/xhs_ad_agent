import type { NoteDetailResponse, NoteDetail, NoteComment } from '@/types/note'

const NOTE_DETAIL_API = 'https://justus-api.e-idear.com/crawler/api/v1/search/ad/note_detail_comment'

export interface FetchNoteDetailResult {
  success: boolean
  detail?: NoteDetail
  comments?: NoteComment[]
  error?: string
}

/**
 * 从文本中提取小红书链接（支持混合文本）
 * 例如: "减掉30斤后我才知道｜这些弯路你别走了 曾经的我也是... http://xhslink.com/o/4jSAloOZrUC 复制后打开【小红书】查看笔记！"
 */
export function extractXhsUrl(text: string): string | null {
  // 匹配各种可能的小红书 URL
  const urlPatterns = [
    // xhslink.com 短链接
    /https?:\/\/xhslink\.com\/[^\s\u4e00-\u9fa5]+/i,
    // 标准小红书链接
    /https?:\/\/(?:www\.)?xiaohongshu\.com\/[^\s\u4e00-\u9fa5]+/i,
    // 发现页链接
    /https?:\/\/(?:www\.)?xiaohongshu\.com\/explore\/[a-f0-9]+/i,
    // discovery 链接
    /https?:\/\/(?:www\.)?xiaohongshu\.com\/discovery\/item\/[a-f0-9]+/i,
  ]

  for (const pattern of urlPatterns) {
    const match = text.match(pattern)
    if (match) {
      return match[0]
    }
  }

  return null
}

/**
 * 解析短链接获取重定向后的目标 URL
 */
export async function resolveShortLink(shortUrl: string): Promise<string | null> {
  try {
    // 使用 HEAD 请求获取重定向位置
    const response = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'manual',
    })

    // 检查是否有重定向
    const location = response.headers.get('location')
    if (location) {
      return location
    }

    // 如果 HEAD 请求没有重定向，尝试 GET 请求
    const getResponse = await fetch(shortUrl, {
      redirect: 'manual',
    })

    const getLocation = getResponse.headers.get('location')
    if (getLocation) {
      return getLocation
    }

    return null
  } catch (error) {
    console.error('resolveShortLink error:', error)
    return null
  }
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
 * 从输入文本中提取笔记ID（支持混合文本、短链接等）
 * 这是一个高级函数，会自动处理各种格式
 */
export async function extractNoteIdFromInput(input: string): Promise<{
  success: boolean
  noteId?: string
  resolvedUrl?: string
  error?: string
}> {
  // 先尝试从输入中提取 URL
  const url = extractXhsUrl(input) || input.trim()

  // 尝试直接从 URL 提取 noteId
  let noteId = extractNoteId(url)
  if (noteId) {
    return { success: true, noteId, resolvedUrl: url }
  }

  // 如果是短链接，尝试解析
  if (url.includes('xhslink.com')) {
    const resolvedUrl = await resolveShortLink(url)
    if (resolvedUrl) {
      noteId = extractNoteId(resolvedUrl)
      if (noteId) {
        return { success: true, noteId, resolvedUrl }
      }
    }
    return { success: false, error: '无法解析短链接，请直接粘贴笔记完整链接' }
  }

  return { success: false, error: '无效的笔记链接格式' }
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
