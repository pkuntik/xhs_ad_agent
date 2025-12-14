'use server'

import { createAnthropicClient, generateUserId } from '@/lib/anthropic/client'
import { buildSystemPrompt, buildUserMessage } from '@/lib/anthropic/prompts'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import type { CreationFormData, LearningData, GenerationResult } from '@/types/creation'

/**
 * 生成小红书笔记内容
 */
export async function generateContent(
  formData: CreationFormData,
  learningData?: LearningData
): Promise<{ success: boolean; result?: GenerationResult; rawText?: string; error?: string }> {
  try {
    // 验证必填字段
    if (!formData.promotionGoal || !formData.topic || !formData.audienceType) {
      return { success: false, error: '请填写必填字段' }
    }

    // 创建 Anthropic 客户端
    const client = createAnthropicClient()
    const systemPrompt = buildSystemPrompt()
    const userMessage = buildUserMessage(formData, learningData)
    const userId = generateUserId()

    // 使用流式请求（Opus 模型需要）
    const stream = client.messages.stream({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: '{' }  // 预填充确保 JSON 格式
      ],
      metadata: { user_id: userId }
    })

    // 等待流完成并收集文本
    const response = await stream.finalMessage()

    // 提取文本内容
    let rawText = '{'
    for (const block of response.content) {
      if (block.type === 'text') {
        rawText += block.text
      }
    }

    // 尝试解析 JSON
    try {
      const result = JSON.parse(rawText) as GenerationResult
      return { success: true, result, rawText }
    } catch (e) {
      // JSON 解析失败，返回原始文本
      return { success: true, rawText }
    }
  } catch (error: any) {
    console.error('生成内容失败:', error)

    // 处理常见错误
    if (error?.status === 401) {
      return { success: false, error: 'API Key 认证失败，请检查配置' }
    }
    if (error?.status === 429) {
      return { success: false, error: '请求过于频繁，请稍后重试' }
    }

    return { success: false, error: error.message || '生成失败，请重试' }
  }
}

/**
 * 生成图片
 */
export async function generateImage(params: {
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
  }
  aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
}): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    const { prompt, imageType, context, aspectRatio = '9:16' } = params

    if (!prompt) {
      return { success: false, error: '请提供图片生成提示词' }
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    const geminiBaseUrl = process.env.GEMINI_BASE_URL || 'https://api3.wlai.vip'

    if (!geminiApiKey) {
      return { success: false, error: 'GEMINI_API_KEY 未配置' }
    }

    // 构建完整提示词
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

【封面文案】
${context?.coverCopywriting || ''}

【视觉风格】
- 配色方案：${context?.colorScheme || '明亮清新'}
- 画面比例：${aspectRatio} 竖屏

请生成一张吸引目标受众点击的小红书封面图。`
    } else {
      fullPrompt = `请生成小红书笔记的配图：

【图片描述】
${prompt}

【具体内容】
${context?.imageContent || ''}

${context?.overlay ? `【文字覆盖】\n${context.overlay}\n` : ''}

【笔记主题】
${context?.topic || '通用内容'}

【视觉要求】
- 画面比例：${aspectRatio} 竖屏
- 风格：清晰、真实、有代入感

请生成一张符合小红书配图风格的图片。`
    }

    // 构建请求
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
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            topK: 40,
          }
        }),
        dispatcher,
      } as any
    )

    if (!response.ok) {
      return { success: false, error: `图片生成失败: ${response.status}` }
    }

    const data: any = await response.json()

    // 提取图片 URL
    let imageUrl = null

    const candidate = data.candidates?.[0]
    if (candidate) {
      const part = candidate.content?.parts?.[0]
      if (part) {
        imageUrl = part.imageUrl || part.url || part.image_url

        if (!imageUrl && part.inlineData) {
          const mimeType = part.inlineData.mimeType || 'image/png'
          const base64Data = part.inlineData.data
          if (base64Data) {
            imageUrl = `data:${mimeType};base64,${base64Data}`
          }
        }
      }
    }

    if (!imageUrl) {
      imageUrl = data.imageUrl || data.image_url || data.url
    }

    if (!imageUrl && data.generations?.[0]) {
      imageUrl = data.generations[0].imageUrl || data.generations[0].url
    }

    if (!imageUrl) {
      return { success: false, error: '未能从 API 响应中提取图片数据' }
    }

    return { success: true, imageUrl }
  } catch (error: any) {
    console.error('图片生成失败:', error)
    return { success: false, error: error.message || '图片生成失败' }
  }
}
