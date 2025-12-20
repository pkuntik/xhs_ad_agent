import { xhsRequest } from '../client'

// ============ 类型定义 ============

// 上传凭证响应
export interface UploadPermit {
  expireTime: number
  cloudType: number
  uploadId: number
  fileIds: string[]
  token: string
  uploadAddr: string
}

export interface UploadPermitResponse {
  uploadTempPermits: UploadPermit[]
}

// 图片信息
export interface NoteImage {
  file_id: string
  height: number
  width: number
}

// @提及用户
export interface NoteMention {
  nickname: string
  index: string
  denotation_char: string
  image?: string
  user_id: string
  user_nickname: string
  value: string
  name: string
  _type: string
}

// 话题标签
export interface NoteHashTag {
  id: string
  name: string
  link: string
  type: string
}

// 发布笔记请求
export interface PublishNoteRequest {
  common: {
    type: 'normal' | 'video'
    title: string
    desc: string
    ats?: NoteMention[]
    hash_tags?: NoteHashTag[]
    post_loc?: {
      poi_id: string
      name: string
      subname: string
      poi_type: number
    }
    biz_relations?: unknown[]
  }
  image_info?: {
    images: NoteImage[]
  }
  video_info?: unknown
  material_note_id?: string | null
  platform: number
  user_type: number
  user_id: string
  operate: number
}

// 发布笔记响应
export interface PublishNoteResponse {
  note_id: string
  score: number
  share_link: string
}

// ============ API 接口 ============

/**
 * 获取上传凭证
 * GET /api/light/ad_material/upload/web/permit
 */
export async function getUploadPermit(
  cookie: string,
  options: {
    bizName?: string
    scene?: string
    fileCount?: number
    version?: number
    source?: string
  } = {}
): Promise<UploadPermitResponse> {
  const {
    bizName = 'spectrum',
    scene = 'image',
    fileCount = 1,
    version = 1,
    source = 'web',
  } = options

  return xhsRequest<UploadPermitResponse>({
    cookie,
    method: 'GET',
    path: '/api/light/ad_material/upload/web/permit',
    params: {
      bizName,
      scene,
      fileCount,
      version,
      source,
    },
  })
}

/**
 * 上传图片到 ROS
 */
export async function uploadImageToRos(
  uploadAddr: string,
  fileId: string,
  token: string,
  imageBuffer: Buffer,
  contentType: string = 'image/jpeg'
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://${uploadAddr}/${fileId}`

    // 计算签名时间
    const now = Math.floor(Date.now() / 1000)
    const expire = now + 86400 // 24小时后过期

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': imageBuffer.length.toString(),
        'x-cos-security-token': token,
        'Authorization': `q-sign-algorithm=sha1&q-ak=null&q-sign-time=${now};${expire}&q-key-time=${now};${expire}&q-header-list=content-length&q-url-param-list=&q-signature=placeholder`,
      },
      body: new Uint8Array(imageBuffer),
    })

    if (!response.ok) {
      return { success: false, error: `上传失败: ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '上传失败',
    }
  }
}

/**
 * 发布笔记
 * POST /api/light/ad_material_note/save
 */
export async function publishNote(
  cookie: string,
  data: PublishNoteRequest
): Promise<PublishNoteResponse> {
  return xhsRequest<PublishNoteResponse>({
    cookie,
    method: 'POST',
    path: '/api/light/ad_material_note/save',
    body: data as unknown as Record<string, unknown>,
  })
}

/**
 * 从 URL 下载图片
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
