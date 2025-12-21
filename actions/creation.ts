'use server'

import { createAnthropicClient, generateUserId } from '@/lib/anthropic/client'
import { buildSystemPrompt, buildUserMessage } from '@/lib/anthropic/prompts'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import type { CreationFormData, LearningData, GenerationResult } from '@/types/creation'
import { getCurrentUserId } from '@/lib/auth/session'
import { deductBalance } from '@/lib/billing/service'

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

    // 获取当前用户并扣费
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: '请先登录' }
    }

    const deductResult = await deductBalance(userId, 'ai_generate_full', {
      relatedType: 'creation',
      description: '完整AI生成',
      metadata: { topic: formData.topic },
    })

    if (!deductResult.success) {
      return { success: false, error: deductResult.error }
    }

    // 创建 Anthropic 客户端
    const client = createAnthropicClient()
    const systemPrompt = buildSystemPrompt()
    const userMessage = buildUserMessage(formData, learningData)
    const anthropicUserId = generateUserId()

    // 使用流式请求（Opus 模型需要）
    const stream = client.messages.stream({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: '{' }  // 预填充确保 JSON 格式
      ],
      metadata: { user_id: anthropicUserId }
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

    // 获取当前用户并扣费
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: '请先登录' }
    }

    const deductResult = await deductBalance(userId, 'image_generate', {
      relatedType: 'image',
      description: '生成图片',
      metadata: { imageType, topic: context?.topic },
    })

    if (!deductResult.success) {
      return { success: false, error: deductResult.error }
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

/**
 * 重新生成规划（封面或配图）
 */
export async function regeneratePlan(params: {
  planType: 'cover' | 'image'
  imageIndex?: number  // 配图索引（当 planType 为 image 时）
  reason?: string      // 重新生成的原因
  context: {
    positioning?: GenerationResult['positioning']
    title?: GenerationResult['title']
    content?: GenerationResult['content']
    cover?: GenerationResult['cover']
    images?: GenerationResult['images']
  }
}): Promise<{
  success: boolean
  plan?: {
    type: string
    content?: string
    overlay?: string
    colorScheme?: string
    tips?: string
  }
  error?: string
}> {
  try {
    const { planType, imageIndex, reason, context } = params

    // 获取当前用户并扣费
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: '请先登录' }
    }

    const deductResult = await deductBalance(userId, 'ai_regenerate_plan', {
      relatedType: 'creation',
      description: `重新生成${planType === 'cover' ? '封面' : '配图'}规划`,
      metadata: { planType, imageIndex, reason },
    })

    if (!deductResult.success) {
      return { success: false, error: deductResult.error }
    }

    // 创建 Anthropic 客户端
    const client = createAnthropicClient()
    const anthropicUserId = generateUserId()

    // 构建提示词
    let userMessage = ''
    const reasonText = reason ? `\n\n【重新生成原因】\n用户反馈：${reason}\n请特别注意避免这个问题，生成一个更好的规划。\n` : ''

    if (planType === 'cover') {
      userMessage = `你是一个小红书封面设计专家。请根据以下内容重新生成一个封面规划。
${reasonText}
【内容定位】
- 内容类型：${context.positioning?.contentType || '分享类'}
- 目标受众：${context.positioning?.targetAudience || '大众'}
- 调性：${context.positioning?.tone || '轻松友好'}
- 关键词：${context.positioning?.keywords?.join('、') || ''}

【标题】
${context.title?.text || ''}

【正文摘要】
${context.content?.body?.slice(0, 200) || ''}

请生成封面规划，包含：类型、主视觉描述、封面文案、配色方案。

请以 JSON 格式返回，只返回 JSON，不要其他内容。`
    } else {
      const currentImage = context.images?.[imageIndex || 0]
      const totalImages = context.images?.length || 1

      userMessage = `你是一个小红书配图设计专家。请根据以下内容重新生成第 ${(imageIndex || 0) + 1}/${totalImages} 张配图的规划。
${reasonText}
【内容定位】
- 内容类型：${context.positioning?.contentType || '分享类'}
- 目标受众：${context.positioning?.targetAudience || '大众'}
- 调性：${context.positioning?.tone || '轻松友好'}

【标题】
${context.title?.text || ''}

【正文摘要】
${context.content?.body?.slice(0, 300) || ''}

【当前配图信息】
- 类型：${currentImage?.type || ''}
- 内容：${currentImage?.content || ''}
- 文字叠加：${currentImage?.overlay || '无'}

请生成新的配图规划，包含：类型、内容描述、文字叠加。

请以 JSON 格式返回，只返回 JSON，不要其他内容。`
    }

    // 调用 AI
    const stream = client.messages.stream({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: '{' }
      ],
      metadata: { user_id: anthropicUserId }
    })

    const response = await stream.finalMessage()

    // 提取文本内容
    let rawText = '{'
    for (const block of response.content) {
      if (block.type === 'text') {
        rawText += block.text
      }
    }

    // 解析 JSON
    try {
      const plan = JSON.parse(rawText)
      return { success: true, plan }
    } catch {
      return { success: false, error: '解析规划结果失败' }
    }
  } catch (error: unknown) {
    console.error('重新生成规划失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '重新生成规划失败' }
  }
}
