import { createAnthropicClient, generateUserId } from '@/lib/anthropic/client'
import { buildSystemPrompt, buildUserMessage } from '@/lib/anthropic/prompts'
import type { CreationFormData, LearningData, GenerationOptions } from '@/types/creation'
import { deductBalance } from '@/lib/billing/service'
import { headers } from 'next/headers'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'

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

// 构建动态 Tool Schema，根据用户选择的生成选项
function buildContentGeneratorTool(options?: GenerationOptions): Tool {
  const properties: Record<string, object> = {
    positioning: {
      type: 'object',
      description: '内容定位分析',
      properties: {
        contentType: { type: 'string', description: '内容类型，如：干货教程、产品种草、经验分享、情绪共鸣、攻略合集等' },
        targetAudience: { type: 'string', description: '目标人群描述' },
        tone: { type: 'string', description: '内容调性' },
        keywords: { type: 'array', items: { type: 'string' }, description: '核心关键词列表' },
      },
      required: ['contentType', 'targetAudience', 'tone', 'keywords'],
    },
  }

  const required: string[] = ['positioning']

  // 根据选项添加相应字段
  if (!options || options.cover !== false) {
    properties.cover = {
      type: 'object',
      description: '封面图规划（第1张图片）',
      properties: {
        index: { type: 'number', description: '固定为1' },
        type: { type: 'string', description: '封面类型，如：要点罗列型、产品展示型、对比图型、人物+文字型、金句海报型、合集预览型等' },
        content: { type: 'string', description: '主视觉元素描述' },
        overlay: { type: 'string', description: '封面文案' },
        colorScheme: { type: 'string', description: '配色方案' },
        tips: { type: 'string', description: '设计建议' },
      },
      required: ['index', 'type', 'content'],
    }
    required.push('cover')
  }

  if (!options || options.title !== false) {
    properties.title = {
      type: 'object',
      description: '标题',
      properties: {
        text: { type: 'string', description: '标题文本（10-20字，严格不超过20字）' },
        highlight: { type: 'string', description: '亮点说明' },
      },
      required: ['text', 'highlight'],
    }
    required.push('title')
  }

  if (!options || options.content !== false) {
    properties.content = {
      type: 'object',
      description: '正文内容',
      properties: {
        body: { type: 'string', description: '完整正文（使用 \\n 换行）' },
        structure: { type: 'string', description: '结构说明' },
      },
      required: ['body', 'structure'],
    }
    required.push('content')
  }

  if (!options || options.images !== false) {
    properties.images = {
      type: 'array',
      description: '配图规划（从第2张开始，1-5张）',
      items: {
        type: 'object',
        properties: {
          index: { type: 'number', description: '图片序号（从2开始）' },
          type: { type: 'string', description: '图片类型，如：产品图、场景图、文字图、对比图等' },
          content: { type: 'string', description: '图片内容描述' },
          overlay: { type: 'string', description: '文字覆盖' },
          colorScheme: { type: 'string', description: '配色方案' },
          tips: { type: 'string', description: '设计建议' },
        },
        required: ['index', 'type', 'content'],
      },
    }
    required.push('images')
  }

  if (!options || options.comments !== false) {
    properties.comments = {
      type: 'object',
      description: '评论区运营',
      properties: {
        pinnedComment: { type: 'string', description: '置顶自评内容' },
        qaList: {
          type: 'array',
          description: '预设问答列表（3-5个）',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string', description: '预设问题' },
              answer: { type: 'string', description: '建议回复' },
            },
            required: ['question', 'answer'],
          },
        },
      },
      required: ['pinnedComment', 'qaList'],
    }
    required.push('comments')
  }

  if (!options || options.topics !== false) {
    properties.topics = {
      type: 'object',
      description: '话题标签',
      properties: {
        tags: { type: 'array', items: { type: 'string' }, description: '话题标签列表（3-5个，每个以#开头）' },
        reason: { type: 'string', description: '选择这些话题的理由' },
      },
      required: ['tags', 'reason'],
    }
    required.push('topics')
  }

  if (options?.privateMessage === true) {
    properties.privateMessage = {
      type: 'object',
      description: '私信模板',
      properties: {
        greeting: { type: 'string', description: '私信开场白' },
        templates: {
          type: 'array',
          description: '场景化回复模板（2-3个）',
          items: {
            type: 'object',
            properties: {
              scenario: { type: 'string', description: '用户咨询场景' },
              message: { type: 'string', description: '私信回复模板' },
            },
            required: ['scenario', 'message'],
          },
        },
      },
      required: ['greeting', 'templates'],
    }
    required.push('privateMessage')
  }

  return {
    name: 'generate_xhs_content',
    description: '生成小红书图文内容方案，包括定位、封面、标题、正文、配图、评论、话题等',
    input_schema: {
      type: 'object',
      properties,
      required,
    },
  }
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

    // 构建动态 Tool
    const contentTool = buildContentGeneratorTool(formData.generationOptions)

    // 创建流式响应
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let toolInput = ''

        try {
          // 发送初始进度
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', percent: 0, label: '正在连接 AI...' })}\n\n`))

          // 使用流式请求 + Tool Use
          const anthropicStream = client.messages.stream({
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
            max_tokens: 16384,
            system: systemPrompt,
            messages: [
              { role: 'user', content: userMessage }
            ],
            tools: [contentTool],
            tool_choice: { type: 'tool', name: 'generate_xhs_content' },
            metadata: { user_id: anthropicUserId }
          })

          let lastDetectedField = ''
          let currentPercent = 5
          let inputJsonChunks = 0

          // 发送开始进度
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', percent: 5, label: 'AI 开始生成...' })}\n\n`))

          // 监听流事件 - Tool Use 模式下监听 input_json_delta
          anthropicStream.on('inputJson', (json) => {
            toolInput += json
            inputJsonChunks++

            // 检测新字段来更新进度
            for (const [field, info] of Object.entries(FIELD_PROGRESS)) {
              const fieldPattern = new RegExp(`"${field}"\\s*:`)
              if (fieldPattern.test(toolInput) && lastDetectedField !== field) {
                if (info.percent > currentPercent) {
                  lastDetectedField = field
                  currentPercent = info.percent
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', percent: info.percent, label: info.label })}\n\n`))
                }
              }
            }
          })

          // 监听错误事件
          anthropicStream.on('error', (err) => {
            console.error('Anthropic stream error event:', err)
            console.error('Error occurred after receiving', inputJsonChunks, 'chunks, total length:', toolInput?.length || 0)
          })

          // 监听流结束事件
          anthropicStream.on('end', () => {
            console.log('Stream end event fired, chunks:', inputJsonChunks, 'total length:', toolInput?.length || 0)
          })

          // 监听消息事件
          anthropicStream.on('message', (msg) => {
            console.log('Stream message event:', msg.stop_reason, 'usage:', JSON.stringify(msg.usage))
          })

          // 等待流完成
          console.log('等待 finalMessage...')
          const response = await anthropicStream.finalMessage()
          console.log('finalMessage 完成, stop_reason:', response.stop_reason)

          // 发送完成进度
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', percent: 100, label: '生成完成！' })}\n\n`))

          // 从 Tool Use 响应中提取结果
          let result = null
          let rawText = ''

          for (const block of response.content) {
            if (block.type === 'tool_use' && block.name === 'generate_xhs_content') {
              // Tool Use 的 input 已经是解析好的 JSON 对象
              result = block.input
              rawText = JSON.stringify(block.input, null, 2)
              break
            }
          }

          if (result) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', success: true, result, rawText })}\n\n`))
          } else {
            // 没有找到 tool_use block，尝试回退到文本解析
            for (const block of response.content) {
              if (block.type === 'text') {
                rawText = block.text
                break
              }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', success: false, rawText, parseError: '未找到有效的工具调用响应' })}\n\n`))
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error: unknown) {
          console.error('流式生成错误:', error)
          console.error('已收集的 toolInput 长度:', toolInput?.length || 0)
          console.error('toolInput 最后 200 字符:', toolInput?.slice(-200))

          let errorMessage = '生成失败'
          let isStreamInterrupted = false

          if (error instanceof Error) {
            errorMessage = error.message
            // 检测是否是流中断相关的错误
            if (error.message.includes('fetch') ||
                error.message.includes('connect') ||
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('network') ||
                error.message.includes('timeout') ||
                error.message.includes('aborted') ||
                error.message.includes('ETIMEDOUT') ||
                error.message.includes('socket') ||
                error.message.includes('Unexpected end of JSON')) {
              isStreamInterrupted = true
              errorMessage = `AI 服务连接中断: ${error.message}`
              console.error('网络错误详情:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                cause: (error as Error & { cause?: unknown }).cause,
              })
            }
          }

          // 尝试从部分数据中恢复
          const hasPartialData = toolInput && toolInput.length > 100
          if (hasPartialData) {
            console.log('尝试解析部分数据...')
            try {
              // 尝试直接解析
              const parsed = JSON.parse(toolInput)
              console.log('部分数据解析成功!')
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', percent: 100, label: '生成完成（从部分数据恢复）' })}\n\n`))
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', success: true, result: parsed, rawText: toolInput })}\n\n`))
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
            } catch {
              console.log('直接解析失败，尝试修复 JSON...')
              // 尝试修复不完整的 JSON（添加缺失的结尾）
              const fixAttempts = [
                toolInput + '}',
                toolInput + '"}',
                toolInput + '"}]}',
                toolInput + '"}}',
                toolInput + ']}}',
              ]
              for (const attempt of fixAttempts) {
                try {
                  const parsed = JSON.parse(attempt)
                  console.log('修复后解析成功!')
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', percent: 100, label: '生成完成（数据已修复）' })}\n\n`))
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', success: true, result: parsed, rawText: attempt })}\n\n`))
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  controller.close()
                  return
                } catch {
                  // 继续尝试下一个修复方案
                }
              }
              console.log('所有修复尝试均失败')
            }
          }

          // 返回错误信息
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'result',
            success: false,
            rawText: hasPartialData ? toolInput : '',
            parseError: isStreamInterrupted && hasPartialData
              ? `生成过程中断（已收集 ${toolInput.length} 字符），请重试`
              : errorMessage
          })}\n\n`))
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
