'use server'

import { nanoid } from 'nanoid'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import { createAnthropicClient, generateUserId } from '@/lib/anthropic/client'
import { uploadToOSS, getOSSConfig } from '@/lib/oss/client'
import { getCurrentUserId } from '@/lib/auth/session'
import { deductBalance } from '@/lib/billing/service'
import type { CreationFormData, GenerationResult, ImagePlan } from '@/types/creation'

// ============ 类型定义 ============

interface ImageGenerateParams {
  prompt: string
  imageType: 'cover' | 'content'
  context?: {
    topic?: string
    contentType?: string
    keywords?: string[]
    targetAudience?: string
    tone?: string
    coverOverlay?: string
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

interface FeedbackExample {
  prompt: string
  feedback: 'like' | 'dislike'
  reason?: string
}

interface ImageGenerationContext {
  formData?: CreationFormData
  positioning?: GenerationResult['positioning']
  cover?: GenerationResult['cover']
  title?: GenerationResult['title']
  content?: GenerationResult['content']
  allImages?: ImagePlan[]
  currentImage?: {
    index: number
    type: string
    content: string
    overlay?: string
    tips?: string
  }
  visualStyle?: string
}

interface PromptGenerationParams {
  imageType: 'cover' | 'content'
  context: ImageGenerationContext
  feedbackExamples?: FeedbackExample[]
  faceSeed?: string
  referenceImageAnalysis?: string
}

// ============ 辅助函数 ============

function generateFaceSeed(): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000000)
  return `FACE_SEED_${timestamp}_${random}`
}

function getProxyDispatcher() {
  const proxyUrl = process.env.PROXY_URL
  return proxyUrl
    ? new ProxyAgent({
        uri: proxyUrl,
        requestTls: { rejectUnauthorized: false },
      })
    : undefined
}

// ============ 图片生成提示词系统提示 ============

const SYSTEM_IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude."

function buildPromptSystemPrompt(imageType: 'cover' | 'content'): string {
  const imageTypeLabel = imageType === 'cover' ? '封面图' : '配图'

  return `${SYSTEM_IDENTITY}

你是小红书图片提示词专家。请为${imageTypeLabel}生成一段自然语言描述，直接发给 Gemini 3 生成图片。

## 核心原则

用自然的中文描述画面，像导演描述分镜一样，不要堆砌关键词。

## 描述要素

1. 主体是谁/是什么，在做什么
2. 场景环境、光线氛围
3. 构图方式（近景/半身/俯拍等）
4. 如需文字，明确写出内容和位置
5. 风格要真实自然，避免过度完美的 AI 感

## ${imageTypeLabel}特点

${imageType === 'cover' ? `封面图要有视觉冲击力，文字清晰醒目，能吸引点击。` : `配图要支撑正文内容，风格与笔记整体一致。`}

## 输出要求

- 直接输出提示词，不要解释
- 用一段连贯的中文描述
- 竖版 9:16 比例
- 不要水印`
}

function buildPromptUserMessage(
  imageType: 'cover' | 'content',
  context: ImageGenerationContext,
  feedbackExamples?: FeedbackExample[],
  faceSeed?: string,
  referenceImageAnalysis?: string
): string {
  const lines: string[] = []
  const { formData, positioning, cover, title, content, allImages, currentImage, visualStyle } = context

  // 开场说明
  if (imageType === 'cover') {
    lines.push('# 请为小红书笔记生成【封面图】的提示词')
    lines.push('')
    lines.push('注意：这是封面图，需要特别注重视觉冲击力和文字装饰效果。')
  } else {
    const imagePosition = currentImage
      ? `第 ${currentImage.index} 张配图（共 ${allImages?.length || '多'} 张）`
      : '配图'
    lines.push(`请为以下小红书笔记的${imagePosition}生成提示词：`)
  }

  // 用户输入
  if (formData) {
    lines.push('')
    lines.push('## 用户输入')
    if (formData.promotionGoal) lines.push(`- 推广目标: ${formData.promotionGoal}`)
    if (formData.topic) lines.push(`- 选题/关键词: ${formData.topic}`)
    if (formData.contentScene) lines.push(`- 内容场景: ${formData.contentScene}`)
    if (formData.audienceType) lines.push(`- 目标受众: ${formData.audienceType}`)
    if (formData.additionalInfo) lines.push(`- 补充说明: ${formData.additionalInfo}`)
  }

  // 内容定位
  if (positioning) {
    lines.push('')
    lines.push('## 内容定位')
    if (positioning.contentType) lines.push(`- 内容类型: ${positioning.contentType}`)
    if (positioning.targetAudience) lines.push(`- 目标受众: ${positioning.targetAudience}`)
    if (positioning.tone) lines.push(`- 内容调性: ${positioning.tone}`)
    if (positioning.keywords?.length) lines.push(`- 关键词: ${positioning.keywords.join('、')}`)
  }

  // 封面规划
  if (cover) {
    lines.push('')
    lines.push('## 封面规划')
    if (cover.type) lines.push(`- 封面类型: ${cover.type}`)
    if (cover.content) lines.push(`- 主视觉: ${cover.content}`)
    if (cover.overlay) lines.push(`- 封面文案: ${cover.overlay}`)
    if (cover.colorScheme) lines.push(`- 配色方案: ${cover.colorScheme}`)
    if (cover.tips) lines.push(`- 设计要点: ${cover.tips}`)
  }

  // 标题
  if (title?.text) {
    lines.push('')
    lines.push('## 标题')
    lines.push(title.text)
  }

  // 正文内容
  if (content?.body) {
    lines.push('')
    lines.push('## 正文内容')
    if (content.structure) lines.push(`- 结构: ${content.structure}`)
    lines.push(`- 字数: ${content.body.length}`)
    lines.push('')
    lines.push('### 正文全文')
    lines.push(content.body)
  }

  // 配图规划总览
  if (allImages && allImages.length > 0) {
    lines.push('')
    lines.push('## 配图规划总览')
    lines.push(`共 ${allImages.length} 张配图`)
    allImages.forEach((img) => {
      const status = img.imagePrompt ? '✅ 已生成' : '⏳ 待生成'
      lines.push('')
      lines.push(`### 图片 ${img.index} [${status}]`)
      lines.push(`- 类型: ${img.type}`)
      lines.push(`- 内容: ${img.content}`)
      if (img.overlay) lines.push(`- 文字覆盖: ${img.overlay}`)
      if (img.tips) lines.push(`- 设计建议: ${img.tips}`)
    })
  }

  // 当前要生成的图片
  if (imageType === 'content' && currentImage) {
    lines.push('')
    lines.push('## 【当前要生成的图片】')
    lines.push(`- 图片序号: 第 ${currentImage.index} 张`)
    lines.push(`- 图片类型: ${currentImage.type}`)
    lines.push(`- 图片内容: ${currentImage.content}`)
    if (currentImage.overlay) lines.push(`- 文字覆盖: ${currentImage.overlay}`)
    if (currentImage.tips) lines.push(`- 设计建议: ${currentImage.tips}`)
  }

  if (imageType === 'cover' && cover) {
    lines.push('')
    lines.push('## 【当前要生成：封面图】')
    lines.push('')
    lines.push('封面图的核心要求：')
    if (cover.overlay) lines.push(`1. 必须体现封面文案「${cover.overlay}」的核心内容`)
    lines.push('2. 封面关键字必须使用视觉装饰元素突出强调')
    if (cover.content) lines.push(`3. 主视觉元素：${cover.content}`)
    if (cover.colorScheme) lines.push(`4. 配色方案：${cover.colorScheme}`)
  }

  // 统一视觉风格
  if (visualStyle) {
    lines.push('')
    lines.push('## 统一视觉风格')
    lines.push(visualStyle)
  }

  // 用户反馈参考
  if (feedbackExamples && feedbackExamples.length > 0) {
    const likedPrompts = feedbackExamples.filter(ex => ex.feedback === 'like')
    const dislikedPrompts = feedbackExamples.filter(ex => ex.feedback === 'dislike')

    lines.push('')
    lines.push('## 用户反馈参考')

    if (likedPrompts.length > 0) {
      lines.push('')
      lines.push('### 喜欢的风格')
      likedPrompts.forEach(ex => {
        lines.push(`- ${ex.prompt.substring(0, 150)}...`)
        if (ex.reason) lines.push(`  原因: ${ex.reason}`)
      })
    }

    if (dislikedPrompts.length > 0) {
      lines.push('')
      lines.push('### 需要避免的风格')
      dislikedPrompts.forEach(ex => {
        lines.push(`- ${ex.prompt.substring(0, 150)}...`)
        if (ex.reason) lines.push(`  问题: ${ex.reason}`)
      })
    }
  }

  // 参考图分析
  if (referenceImageAnalysis) {
    lines.push('')
    lines.push('## 参考图风格分析')
    lines.push(referenceImageAnalysis)
  }

  // 人脸种子
  if (faceSeed) {
    lines.push('')
    lines.push('## 人脸一致性')
    lines.push(`人脸种子: ${faceSeed}`)
    lines.push('请确保所有图片中的人物面部特征保持一致。')
  }

  return lines.join('\n')
}

// ============ Server Actions ============

/**
 * 生成图片（调用 Gemini API）
 */
export async function generateImage(
  params: ImageGenerateParams
): Promise<{ success: boolean; imageUrl?: string; prompt?: string; error?: string }> {
  try {
    const { prompt, imageType, context } = params

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

    // 构建自然语言提示词（适配 Gemini 3 的中文理解能力）
    let fullPrompt = ''

    if (imageType === 'cover') {
      // 封面图提示词 - 用自然语言描述
      const topic = context?.topic || '生活分享'
      const overlay = context?.coverOverlay || ''
      const colorScheme = context?.colorScheme || '明亮清新'
      const tone = context?.tone || '轻松友好'

      fullPrompt = `当前时间是：${new Date().toISOString()}
请生成一张小红书封面图。

${prompt}

这是一篇关于「${topic}」的笔记，调性是${tone}的。
${overlay ? `封面需要展示文字「${overlay}」，文字要清晰醒目，用${colorScheme}的配色。` : `配色风格是${colorScheme}。`}

要求：
- 竖版9:16比例，适合手机屏幕
- 画面干净清爽，符合小红书的审美
- 如果有文字，必须是中文，清晰可读
- 不要水印、不要多余装饰`

    } else {
      // 配图提示词 - 直接使用 Claude 生成的提示词
      const topic = context?.topic || '生活分享'
      const overlay = context?.overlay || ''
      const imageIndex = context?.imageIndex || 1

      fullPrompt = `当前时间是：${new Date().toISOString()}
请生成一张小红书笔记配图。

${prompt}

这是笔记的第${imageIndex}张图，主题是「${topic}」。
${overlay ? `图片上需要有文字「${overlay}」，文字清晰可读。` : ''}

要求：
- 竖版9:16比例
- 画面真实自然，有生活气息
- 风格要和小红书笔记配图一致
- 不要水印`
    }

    const dispatcher = getProxyDispatcher()

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
          },
        }),
        dispatcher,
      } as Parameters<typeof undiciFetch>[1]
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API Error:', errorText)
      return { success: false, error: `图片生成失败: ${response.status}` }
    }

    const data = await response.json() as Record<string, unknown>

    let imageUrl: string | null = null

    // 尝试提取图片 URL
    const candidates = data.candidates as Array<{ content?: { parts?: Array<Record<string, unknown>> } }> | undefined
    const candidate = candidates?.[0]
    if (candidate) {
      const part = candidate.content?.parts?.[0]
      if (part) {
        imageUrl = (part.imageUrl || part.url || part.image_url) as string | null

        if (!imageUrl) {
          const inlineData = part.inlineData as { mimeType?: string; data?: string } | undefined
          if (inlineData?.data) {
            const mimeType = inlineData.mimeType || 'image/png'
            imageUrl = `data:${mimeType};base64,${inlineData.data}`
          }
        }
      }
    }

    if (!imageUrl) {
      imageUrl = (data.imageUrl || data.image_url || data.url) as string | null
    }

    if (!imageUrl) {
      const generations = data.generations as Array<{ imageUrl?: string; url?: string }> | undefined
      if (generations?.[0]) {
        imageUrl = generations[0].imageUrl || generations[0].url || null
      }
    }

    if (!imageUrl) {
      console.error('无法提取图片 URL，完整响应:', data)
      return { success: false, error: '未能从 API 响应中提取图片数据' }
    }

    return { success: true, imageUrl, prompt: fullPrompt }
  } catch (error) {
    console.error('Image Generation Error:', error)
    return { success: false, error: error instanceof Error ? error.message : '图片生成失败' }
  }
}

/**
 * 生成图片提示词（调用 Claude API）
 */
export async function generateImagePrompt(
  params: PromptGenerationParams
): Promise<{ success: boolean; prompt?: string; faceSeed?: string; error?: string }> {
  try {
    const { imageType, context, feedbackExamples, faceSeed: providedFaceSeed, referenceImageAnalysis } = params

    const client = createAnthropicClient()
    const anthropicUserId = generateUserId()

    const faceSeed = providedFaceSeed || generateFaceSeed()
    const systemPrompt = buildPromptSystemPrompt(imageType)
    const userMessage = buildPromptUserMessage(imageType, context, feedbackExamples, faceSeed, referenceImageAnalysis)

    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: 5000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      metadata: { user_id: anthropicUserId },
    })

    const generatedPrompt = response.content?.[0]?.type === 'text'
      ? response.content[0].text
      : null

    if (!generatedPrompt) {
      return { success: false, error: '未能生成提示词' }
    }

    return { success: true, prompt: generatedPrompt.trim(), faceSeed }
  } catch (error) {
    console.error('Prompt Generation Error:', error)
    return { success: false, error: error instanceof Error ? error.message : '提示词生成失败' }
  }
}

/**
 * 分析参考图风格（调用 Gemini API）
 */
export async function analyzeReferenceImage(
  imageBase64: string
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  try {
    if (!imageBase64) {
      return { success: false, error: '请提供参考图片' }
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    const geminiBaseUrl = process.env.GEMINI_BASE_URL || 'https://api3.wlai.vip'

    if (!geminiApiKey) {
      return { success: false, error: 'GEMINI_API_KEY 未配置' }
    }

    // 从 base64 中提取数据部分和 MIME 类型
    const base64Match = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
    let mimeType = 'image/jpeg'
    let base64Data = imageBase64

    if (base64Match) {
      mimeType = base64Match[1]
      base64Data = base64Match[2]
    }

    const analysisPrompt = `请分析这张图片的视觉风格，提取以下特征用于图片生成：

1. **构图方式**：居中/三分法/对称/留白位置等
2. **色调风格**：暖色/冷色/高饱和/低饱和/复古/清新等
3. **光线特点**：自然光/柔光/硬光/逆光/侧光等
4. **整体氛围**：温馨/高级/活泼/简约/文艺等
5. **主要元素**：主体内容、背景特点
6. **摄影风格**：胶片感/数码清晰/模糊背景/全景深等

请用简洁的描述词汇输出，格式如下：
- 构图：xxx
- 色调：xxx
- 光线：xxx
- 氛围：xxx
- 元素：xxx
- 风格：xxx`

    const dispatcher = getProxyDispatcher()

    const response = await undiciFetch(
      `${geminiBaseUrl}/v1beta/models/gemini-3-pro-image-preview:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${geminiApiKey}`,
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: analysisPrompt },
            ],
          }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
          },
        }),
        dispatcher,
      } as Parameters<typeof undiciFetch>[1]
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API Error:', errorText)
      return { success: false, error: `参考图分析失败: ${response.status}` }
    }

    const data = await response.json() as Record<string, unknown>
    const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined
    const analysisText = candidates?.[0]?.content?.parts?.[0]?.text

    if (!analysisText) {
      console.error('无法提取分析结果，完整响应:', data)
      return { success: false, error: '未能从 API 响应中提取分析结果' }
    }

    return { success: true, analysis: analysisText.trim() }
  } catch (error) {
    console.error('Reference Image Analysis Error:', error)
    return { success: false, error: error instanceof Error ? error.message : '参考图分析失败' }
  }
}

/**
 * 上传图片到 OSS
 */
export async function uploadImage(
  imageData: string,
  filename?: string
): Promise<{ success: boolean; imageUrl?: string; filename?: string; error?: string }> {
  try {
    if (!imageData) {
      return { success: false, error: '请提供图片数据' }
    }

    // 检查 OSS 是否已配置
    const ossConfig = getOSSConfig()
    if (!ossConfig.isConfigured) {
      return { success: false, error: 'OSS 未配置' }
    }

    // 解析 base64 数据
    let base64Data = imageData
    let mimeType = 'image/png'

    if (imageData.startsWith('data:')) {
      const matches = imageData.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        mimeType = matches[1]
        base64Data = matches[2]
      }
    }

    // 确定文件扩展名
    const extMap: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
    }
    const ext = extMap[mimeType] || '.png'

    // 生成文件名和路径
    const finalFilename = filename ? `${filename}${ext}` : `${nanoid(12)}${ext}`
    const key = `images/${finalFilename}`

    // 转换为 Buffer
    const buffer = Buffer.from(base64Data, 'base64')

    // 上传到 OSS
    const imageUrl = await uploadToOSS(key, buffer, mimeType)

    return { success: true, imageUrl, filename: finalFilename }
  } catch (error) {
    console.error('Image Upload Error:', error)
    return { success: false, error: error instanceof Error ? error.message : '图片上传失败' }
  }
}
