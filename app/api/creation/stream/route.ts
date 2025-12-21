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

          // 尝试修复和解析 JSON
          let result = null
          let parseError = ''

          // 辅助函数：修复 JSON 字符串中的控制字符
          const fixJsonString = (text: string): string => {
            let fixed = ''
            let inString = false
            let i = 0

            while (i < text.length) {
              const char = text[i]
              const code = char.charCodeAt(0)

              if (inString) {
                // 在字符串内部
                if (char === '\\' && i + 1 < text.length) {
                  const nextChar = text[i + 1]
                  const nextCode = nextChar.charCodeAt(0)

                  // 如果下一个字符是控制字符，说明 AI 写了 \<实际换行>，应该转换为 \n
                  if (nextCode < 32) {
                    switch (nextCode) {
                      case 10: fixed += '\\n'; break
                      case 13: fixed += '\\r'; break
                      case 9:  fixed += '\\t'; break
                      default: fixed += '\\u' + nextCode.toString(16).padStart(4, '0')
                    }
                    i += 2
                    continue
                  }

                  // 正常的转义序列，保留两个字符
                  fixed += char + nextChar
                  i += 2
                  continue
                }

                if (char === '"') {
                  // 字符串结束
                  inString = false
                  fixed += char
                  i++
                  continue
                }

                // 处理字符串中的控制字符（没有前导反斜杠的情况）
                if (code < 32) {
                  switch (code) {
                    case 10: fixed += '\\n'; break
                    case 13: fixed += '\\r'; break
                    case 9:  fixed += '\\t'; break
                    case 8:  fixed += '\\b'; break
                    case 12: fixed += '\\f'; break
                    default: fixed += '\\u' + code.toString(16).padStart(4, '0')
                  }
                  i++
                  continue
                }

                fixed += char
                i++
              } else {
                // 在字符串外部
                if (char === '"') {
                  inString = true
                }
                fixed += char
                i++
              }
            }

            // 如果还在字符串内，说明缺少闭合引号
            if (inString) {
              fixed += '"'
            }

            return fixed
          }

          // 辅助函数：尝试修复并解析 JSON
          const tryParseJson = (text: string): object | null => {
            // 第一步：清理 markdown 代码块标记
            let cleaned = text.trim()
            cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
            cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '')

            // 第二步：修复字符串中的控制字符
            const fixed = fixJsonString(cleaned)

            // 第三步：修复未闭合的括号
            let balanced = fixed
            const openBraces = (balanced.match(/{/g) || []).length
            const closeBraces = (balanced.match(/}/g) || []).length
            const openBrackets = (balanced.match(/\[/g) || []).length
            const closeBrackets = (balanced.match(/]/g) || []).length

            // 添加缺失的闭合括号（按正确顺序）
            const missingBrackets = openBrackets - closeBrackets
            const missingBraces = openBraces - closeBraces

            if (missingBrackets > 0 || missingBraces > 0) {
              // 分析结尾来决定添加顺序
              const trimmed = balanced.trimEnd()
              const lastChar = trimmed[trimmed.length - 1]

              // 移除末尾可能的不完整内容
              if (lastChar !== '}' && lastChar !== ']' && lastChar !== '"' &&
                  lastChar !== 'e' && lastChar !== 'l' && // true, false, null
                  !/[0-9]/.test(lastChar)) {
                // 尝试找到最后一个完整的值
                const lastCompleteIdx = Math.max(
                  trimmed.lastIndexOf('}'),
                  trimmed.lastIndexOf(']'),
                  trimmed.lastIndexOf('"'),
                )
                if (lastCompleteIdx > 0) {
                  balanced = trimmed.substring(0, lastCompleteIdx + 1)
                }
              }

              // 移除末尾的逗号
              balanced = balanced.replace(/,\s*$/, '')

              // 重新计算缺失的括号
              const newOpenBrackets = (balanced.match(/\[/g) || []).length
              const newCloseBrackets = (balanced.match(/]/g) || []).length
              const newOpenBraces = (balanced.match(/{/g) || []).length
              const newCloseBraces = (balanced.match(/}/g) || []).length

              // 添加缺失的闭合括号
              for (let i = 0; i < newOpenBrackets - newCloseBrackets; i++) {
                balanced += ']'
              }
              for (let i = 0; i < newOpenBraces - newCloseBraces; i++) {
                balanced += '}'
              }
            }

            // 第四步：移除对象/数组中末尾的逗号
            balanced = balanced.replace(/,(\s*[}\]])/g, '$1')

            return JSON.parse(balanced)
          }

          try {
            result = JSON.parse(fullText)
          } catch (e) {
            parseError = e instanceof Error ? e.message : 'JSON 解析失败'

            // 尝试使用修复函数
            try {
              result = tryParseJson(fullText)
              console.log('JSON 修复成功')
            } catch (e2) {
              console.error('JSON 修复失败:', parseError, e2 instanceof Error ? e2.message : '')
            }
          }

          if (result) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', success: true, result, rawText: fullText })}\n\n`))
          } else {
            // JSON 解析失败，返回原始文本和错误信息
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', success: false, rawText: fullText, parseError })}\n\n`))
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error: unknown) {
          console.error('流式生成错误:', error)
          // 输出更详细的错误信息用于调试
          let errorMessage = '生成失败'
          if (error instanceof Error) {
            errorMessage = error.message
            // 检查是否是网络连接错误
            if (error.message.includes('fetch') || error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
              errorMessage = `连接 AI 服务失败: ${error.message}`
              console.error('网络错误详情:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                cause: (error as Error & { cause?: unknown }).cause,
              })
            }
          }
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
