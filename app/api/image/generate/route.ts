import { NextRequest } from 'next/server'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import { headers } from 'next/headers'
import { deductBalance } from '@/lib/billing/service'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ImagePrompt {
  prompt: string
  imageType: 'cover' | 'content'
  context?: {
    topic?: string
    contentType?: string
    keywords?: string[]
    targetAudience?: string
    tone?: string
    coverCopywriting?: string
    colorScheme?: string
    overlay?: string
    imageContent?: string
    imageIndex?: number
    totalImages?: number
    contentStructure?: string
    contentBody?: string
  }
  aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageType, context, aspectRatio = '9:16' }: ImagePrompt = await req.json()

    if (!prompt) {
      return Response.json(
        { error: '请提供图片生成提示词' },
        { status: 400 }
      )
    }

    // 获取当前用户并扣费
    const headersList = await headers()
    const userId = headersList.get('x-user-id')
    if (!userId) {
      return Response.json(
        { error: '请先登录' },
        { status: 401 }
      )
    }

    // 扣费
    const deductResult = await deductBalance(userId, 'image_generate', {
      relatedType: 'image',
      description: '生成图片',
      metadata: { imageType, topic: context?.topic },
    })

    if (!deductResult.success) {
      return Response.json(
        { error: deductResult.error },
        { status: 402 }
      )
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    const geminiBaseUrl = process.env.GEMINI_BASE_URL || 'https://api3.wlai.vip'

    if (!geminiApiKey) {
      return Response.json(
        { error: 'GEMINI_API_KEY 未配置，请在 .env.local 中设置' },
        { status: 500 }
      )
    }

    let fullPrompt = ''

    if (imageType === 'cover') {
      fullPrompt = `请生成一张小红书笔记的封面图：

【核心视觉要求】
${prompt}

【笔记主题】
${context?.topic || '通用内容'}

【内容定位】
- 内容类型：${context?.contentType || '分享类'}
- 目标受众：${context?.targetAudience || '大众'}
- 内容调性：${context?.tone || '轻松友好'}
- 关键词：${context?.keywords?.join('、') || ''}

【封面文案】
${context?.coverCopywriting || ''}

【视觉风格】
- 配色方案：${context?.colorScheme || '明亮清新'}
- 画面比例：${aspectRatio} 竖屏
- 风格要求：干净、现代、符合小红书平台审美
- 设计目标：吸引点击、传达主题、预留文字空间

【笔记内容概要】
${context?.contentBody ? context.contentBody.substring(0, 200) + '...' : ''}

请生成一张能够准确传达笔记主题、吸引目标受众点击的小红书封面图。`
    } else {
      const imagePosition = context?.imageIndex ? `第 ${context.imageIndex} 张配图（共 ${context.totalImages || '多'} 张）` : '配图'

      fullPrompt = `请生成小红书笔记的${imagePosition}：

【图片描述】
${prompt}

【具体内容】
${context?.imageContent || ''}

${context?.overlay ? `【文字覆盖】\n${context.overlay}\n` : ''}

【笔记主题】
${context?.topic || '通用内容'}

【内容定位】
- 内容类型：${context?.contentType || '分享类'}
- 目标受众：${context?.targetAudience || '大众'}
- 内容调性：${context?.tone || '轻松友好'}
- 关键词：${context?.keywords?.join('、') || ''}

【笔记结构】
${context?.contentStructure || ''}

【正文内容片段】
${context?.contentBody ? context.contentBody.substring(0, 300) + '...' : ''}

【视觉要求】
- 画面比例：${aspectRatio} 竖屏
- 风格：清晰、真实、有代入感
- 目的：支撑正文内容第 ${context?.imageIndex || ''} 部分的叙述
- 与笔记整体风格保持一致

请生成一张符合小红书配图风格、能够有效支撑正文内容的图片。`
    }

    const proxyUrl = process.env.PROXY_URL
    const dispatcher = proxyUrl
      ? new ProxyAgent({
          uri: proxyUrl,
          requestTls: { rejectUnauthorized: false },
        })
      : undefined

    const response = await undiciFetch(
      `${geminiBaseUrl}/v1beta/models/gemini-3-pro-image-preview:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${geminiApiKey}`,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: fullPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            topK: 40,
          },
        }),
        dispatcher,
      } as Parameters<typeof undiciFetch>[1]
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API Error:', errorText)
      return Response.json(
        { error: `图片生成失败: ${response.status} ${response.statusText}` },
        { status: response.status as number }
      )
    }

    const data = await response.json() as Record<string, unknown>

    let imageUrl: string | null = null

    // 尝试方式 1: candidates[0].content.parts[0]
    const candidates = data.candidates as Array<{ content?: { parts?: Array<Record<string, unknown>> } }> | undefined
    const candidate = candidates?.[0]
    if (candidate) {
      const part = candidate.content?.parts?.[0]
      if (part) {
        imageUrl = (part.imageUrl || part.url || part.image_url) as string | null

        // 尝试方式 2: 检查 inlineData
        if (!imageUrl) {
          const inlineData = part.inlineData as { mimeType?: string; data?: string } | undefined
          if (inlineData) {
            const mimeType = inlineData.mimeType || 'image/png'
            const base64Data = inlineData.data
            if (base64Data) {
              imageUrl = `data:${mimeType};base64,${base64Data}`
            }
          }
        }
      }
    }

    // 尝试方式 3: 检查根级别的 imageUrl
    if (!imageUrl) {
      imageUrl = (data.imageUrl || data.image_url || data.url) as string | null
    }

    // 尝试方式 4: 检查 generations 字段
    if (!imageUrl) {
      const generations = data.generations as Array<{ imageUrl?: string; url?: string }> | undefined
      if (generations?.[0]) {
        imageUrl = generations[0].imageUrl || generations[0].url || null
      }
    }

    if (!imageUrl) {
      console.error('无法提取图片 URL，完整响应:', data)
      return Response.json(
        {
          error: '未能从 API 响应中提取图片数据',
          debug: {
            hasData: !!data,
            hasCandidates: !!candidates,
            candidatesLength: candidates?.length || 0,
            responseKeys: Object.keys(data || {}),
          },
        },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      imageUrl: imageUrl,
      prompt: fullPrompt,
      aspectRatio: aspectRatio,
      imageType: imageType,
    })

  } catch (error: unknown) {
    console.error('Image Generation Error:', error)
    const errorMessage = error instanceof Error ? error.message : '图片生成失败'
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
