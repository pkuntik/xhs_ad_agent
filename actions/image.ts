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
    tips: string
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
  const imageTypeLabel = imageType === 'cover' ? '封面图' : '正文配图'

  const coverSpecificRequirements = `
## 封面图特殊要求（小红书封面海报）

### 布局与文字渲染
1. **Clean modern layout, strong hierarchy** - 干净现代的布局，层次分明
2. **文字必须清晰可读**：用引号固定文本内容，指定位置（居中/左上角/底部等）
3. **重点文字必须突出强调**: 使用以下装饰元素：
   - 彩色背景涂鸦或色块
   - 手绘风格的下划线或波浪线
   - 荧光笔高光效果
   - 手绘圆圈或方框
   - 星星、箭头等手绘装饰元素

### 文字渲染技巧（关键！）
- 写法示例：Main title "标题内容" centered, large bold Chinese font, high contrast, perfectly readable
- 指定排版：两行 / 字距稍大 / 不换行
- **约束**：除标题外不要任何多余文字、不要logo、不要水印

### 参考模板
> Design a Xiaohongshu cover poster about (主题). Clean modern layout, strong hierarchy.
> Main title "(标题)" centered, large bold Chinese font, high contrast, perfectly readable.
> Subtitle "(副标题)" below. Background: (风格/元素). No watermark. Aspect ratio 9:16.`

  const contentSpecificRequirements = `
## 配图特殊要求
1. 要能支撑正文内容的叙述
2. 与笔记整体风格保持一致（Keep identity/style consistent）
3. 画面内容要与对应的正文段落相关
4. 如需文字覆盖，明确写出："在[位置]写"具体文字"，字体[无衬线/黑体]，清晰可读"`

  return `${SYSTEM_IDENTITY}

你是一位专业的AI图片生成提示词专家，专门为小红书平台生成高质量的${imageTypeLabel}提示词。

## 核心原则：导演分镜式描述（非常重要！）

**不要写"关键词汤"，要写成"导演分镜式描述"**——用一段自然语言把主体、动作、环境、风格讲清楚，画面会更连贯。

### 提示词结构模板（按顺序组织）

1. **画面类型/用途**：海报/电商主图/信息图/头像/产品渲染…
2. **主体**：[是谁/是什么] 正在 [做什么]
3. **场景**：[地点/时代/天气/背景元素]
4. **构图**：[近景/半身/全身/俯拍/仰拍/居中/三分法/留白位置]
5. **镜头**（可选）：[35mm/50mm/85mm]，[f/1.8…]，[景深/虚化]
6. **光线与色彩**：[柔光/硬光/逆光]，[冷暖/胶片/电影分级]
7. **质感**：[皮肤纹理/材质参数/微瑕疵]
8. **文本（如需要）**：在[位置]写"……"，字体[无衬线/黑体/霓虹…]，清晰可读
9. **约束**：只允许改变[X]，其他保持不变；不要[Y]（水印/多余文字/多手指…）
10. **输出**：Aspect ratio 9:16

## 核心要求：真实感与自然感

**必须避免 AI 味过重！**小红书用户喜欢真实、自然、有生活气息的图片。

### 增加真实感的技巧（主动要"摄影缺陷"）

适合拟真照片、街拍、生活化场景，可以加入：
- 轻微手持抖动感（subtle handheld shake）
- 暗角（slight vignette）
- 少量颗粒感（subtle film grain）
- 局部高光略过曝（slightly overexposed highlights）
- 镜头微尘（lens dust particles）
- 轻微的对焦不准（slight focus softness on edges）

### 避免 AI 味的写法
- ❌ 避免: "完美的光线"、"完美的构图"、"完美无瑕的皮肤"、"梦幻般的"、"精致的"
- ✅ 使用: "自然光线"、"随意的构图"、"真实的肤质"、"日常的"、"随手拍的"、"生活化的"

## 基本要求
1. 画面比例: 9:16 竖版（小红书封面/抖音封面）
2. 适合在手机上浏览
3. 不要水印、不要多余文字、不要logo
${imageType === 'cover' ? coverSpecificRequirements : contentSpecificRequirements}

## 人脸一致性要求（Keep-Rules）

如果图片中需要出现人物：
- 基于用户提供的人脸种子生成独特的人脸特征
- **Keep identity, hairstyle identical** - 同一笔记所有图片人脸保持一致
- 发型、穿着、妆容可以根据场景自然调整，但面部特征必须一致
- 人脸要真实自然，符合亚洲人特征，避免过度完美的AI脸
- 写法：Keep everything else unchanged. Only change [表情/姿势]; keep identity/facial features the same.

## 输出要求
直接输出完整的提示词，用自然语言描述，不要有任何解释或标题。
提示词应该是一段连贯的描述，而不是关键词的简单堆砌。`
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

  if (formData) {
    lines.push('')
    lines.push('## 用户输入')
    lines.push(`- 推广目标: ${formData.promotionGoal}`)
    lines.push(`- 选题/关键词: ${formData.topic}`)
    lines.push(`- 内容场景: ${formData.contentScene}`)
    lines.push(`- 目标受众: ${formData.audienceType}`)
    if (formData.additionalInfo) {
      lines.push(`- 补充说明: ${formData.additionalInfo}`)
    }
  }

  if (positioning) {
    lines.push('')
    lines.push('## 内容定位')
    lines.push(`- 内容类型: ${positioning.contentType}`)
    lines.push(`- 目标受众: ${positioning.targetAudience}`)
    lines.push(`- 内容调性: ${positioning.tone}`)
    if (positioning.keywords?.length) {
      lines.push(`- 关键词: ${positioning.keywords.join('、')}`)
    }
  }

  if (cover) {
    lines.push('')
    lines.push('## 封面规划')
    lines.push(`- 封面类型: ${cover.type}`)
    lines.push(`- 主视觉: ${cover.mainVisual}`)
    lines.push(`- 封面文案: ${cover.copywriting}`)
    lines.push(`- 文字位置: ${cover.textPosition}`)
    lines.push(`- 配色方案: ${cover.colorScheme}`)
    lines.push(`- 设计要点: ${cover.designTips}`)
  }

  if (title) {
    lines.push('')
    lines.push('## 标题')
    lines.push(title.text)
  }

  if (content) {
    lines.push('')
    lines.push('## 正文内容')
    lines.push(`- 结构: ${content.structure}`)
    lines.push(`- 字数: ${content.wordCount}`)
    lines.push('')
    lines.push('### 正文全文')
    lines.push(content.body)
  }

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
      if (img.overlay) {
        lines.push(`- 文字覆盖: ${img.overlay}`)
      }
      lines.push(`- 设计建议: ${img.tips}`)
    })
  }

  if (imageType === 'content' && currentImage) {
    lines.push('')
    lines.push('## 【当前要生成的图片】')
    lines.push(`- 图片序号: 第 ${currentImage.index} 张`)
    lines.push(`- 图片类型: ${currentImage.type}`)
    lines.push(`- 图片内容: ${currentImage.content}`)
    if (currentImage.overlay) {
      lines.push(`- 文字覆盖: ${currentImage.overlay}`)
    }
    lines.push(`- 设计建议: ${currentImage.tips}`)
  }

  if (imageType === 'cover' && cover) {
    lines.push('')
    lines.push('## 【当前要生成：封面图】')
    lines.push('')
    lines.push('封面图的核心要求：')
    lines.push(`1. 必须体现封面文案「${cover.copywriting}」的核心内容`)
    lines.push('2. 封面关键字必须使用视觉装饰元素突出强调')
    lines.push(`3. 主视觉元素：${cover.mainVisual}`)
    lines.push(`4. 文字位置：${cover.textPosition}`)
    lines.push(`5. 配色方案：${cover.colorScheme}`)
  }

  if (visualStyle) {
    lines.push('')
    lines.push('## 统一视觉风格')
    lines.push(visualStyle)
  }

  if (feedbackExamples && feedbackExamples.length > 0) {
    const likedPrompts = feedbackExamples.filter(ex => ex.feedback === 'like')
    const dislikedPrompts = feedbackExamples.filter(ex => ex.feedback === 'dislike')

    lines.push('')
    lines.push('## 用户反馈参考')

    if (likedPrompts.length > 0) {
      lines.push('')
      lines.push('### ✅ 我满意的风格（请参考）：')
      likedPrompts.forEach((ex, i) => {
        lines.push(`${i + 1}. 提示词: ${ex.prompt}`)
      })
    }

    if (dislikedPrompts.length > 0) {
      lines.push('')
      lines.push('### ❌ 我不满意的风格（请避免）：')
      dislikedPrompts.forEach((ex, i) => {
        lines.push(`${i + 1}. 提示词: ${ex.prompt}`)
        if (ex.reason) {
          lines.push(`   原因: ${ex.reason}`)
        }
      })
    }
  }

  if (referenceImageAnalysis) {
    lines.push('')
    lines.push('## 参考图风格分析（请参考）')
    lines.push(referenceImageAnalysis)
    lines.push('')
    lines.push('请在生成提示词时融入上述参考图的风格特征。')
  }

  lines.push('')
  lines.push('## 人脸种子')
  lines.push(`本次笔记的人脸随机种子：${faceSeed}`)

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
