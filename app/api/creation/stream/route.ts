import { createAnthropicClient, generateUserId } from '@/lib/anthropic/client'
import { buildSystemPrompt, buildUserMessage } from '@/lib/anthropic/prompts'
import type { CreationFormData, LearningData } from '@/types/creation'
import { deductBalance } from '@/lib/billing/service'
import { headers } from 'next/headers'

// JSON 字段对应的进度百分比
const FIELD_PROGRESS: Record<string, { percent: number; label: string }> = {
  positioning: { percent: 10, label: '分析内容定位...' },
  cover: { percent: 25, label: '规划封面设计...' },
  title: { percent: 40, label: '生成标题...' },
  content: { percent: 60, label: '撰写正文内容...' },
  images: { percent: 75, label: '规划配图...' },
  comments: { percent: 85, label: '准备评论区运营...' },
  topics: { percent: 92, label: '选择话题标签...' },
  privateMessage: { percent: 98, label: '生成私信模板...' },
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { formData, learningData } = body as {
      formData: CreationFormData
      learningData?: LearningData
    }

    // 验证必填字段
    if (!formData.promotionGoal || !formData.topic || !formData.audienceType) {
      return new Response(
        JSON.stringify({ error: '请填写必填字段' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 获取当前用户并扣费
    const headersList = await headers()
    const userId = headersList.get('x-user-id')
    if (!userId) {
      return new Response(
        JSON.stringify({ error: '请先登录' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 扣费
    const deductResult = await deductBalance(userId, 'ai_generate_full', {
      relatedType: 'creation',
      description: '完整AI生成',
      metadata: { topic: formData.topic },
    })

    if (!deductResult.success) {
      return new Response(
        JSON.stringify({ error: deductResult.error }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 创建 Anthropic 客户端
    const client = createAnthropicClient()
    const systemPrompt = buildSystemPrompt()
    const userMessage = buildUserMessage(formData, learningData)
    const anthropicUserId = generateUserId()

    // 创建流式响应
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送初始进度
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', percent: 0, label: '正在连接 AI...' })}\n\n`))

          // 使用流式请求
          const anthropicStream = client.messages.stream({
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
            max_tokens: 16384,
            system: systemPrompt,
            messages: [
              { role: 'user', content: userMessage },
              { role: 'assistant', content: '{' }
            ],
            metadata: { user_id: anthropicUserId }
          })

          let fullText = '{'
          let lastDetectedField = ''
          let currentPercent = 5

          // 发送开始进度
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', percent: 5, label: 'AI 开始生成...' })}\n\n`))

          // 监听流事件
          anthropicStream.on('text', (text) => {
            fullText += text

            // 检测新字段
            for (const [field, info] of Object.entries(FIELD_PROGRESS)) {
              // 检查是否出现新字段（格式如 "fieldName": 或 "fieldName":）
              const fieldPattern = new RegExp(`"${field}"\\s*:`)
              if (fieldPattern.test(fullText) && lastDetectedField !== field) {
                if (info.percent > currentPercent) {
                  lastDetectedField = field
                  currentPercent = info.percent
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', percent: info.percent, label: info.label })}\n\n`))
                }
              }
            }
          })

          // 等待流完成
          const response = await anthropicStream.finalMessage()

          // 提取完整文本
          for (const block of response.content) {
            if (block.type === 'text') {
              fullText = '{' + block.text
            }
          }

          // 发送完成进度
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', percent: 100, label: '生成完成！' })}\n\n`))

          // 尝试解析 JSON
          try {
            const result = JSON.parse(fullText)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', success: true, result, rawText: fullText })}\n\n`))
          } catch {
            // JSON 解析失败，返回原始文本
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', success: true, rawText: fullText })}\n\n`))
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error: unknown) {
          console.error('流式生成错误:', error)
          const errorMessage = error instanceof Error ? error.message : '生成失败'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: unknown) {
    console.error('请求处理错误:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '请求处理失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
