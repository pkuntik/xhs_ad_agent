import { NextRequest } from 'next/server'
import { ProxyAgent, fetch as undiciFetch } from 'undici'

export const runtime = 'nodejs'
export const maxDuration = 60

interface AnalyzeReferenceRequest {
  imageBase64: string
}

const ANALYSIS_PROMPT = `请分析这张图片的视觉风格，提取以下特征用于图片生成：

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

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 }: AnalyzeReferenceRequest = await req.json()

    if (!imageBase64) {
      return Response.json(
        { error: '请提供参考图片' },
        { status: 400 }
      )
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    const geminiBaseUrl = process.env.GEMINI_BASE_URL || 'https://api3.wlai.vip'

    if (!geminiApiKey) {
      return Response.json(
        { error: 'GEMINI_API_KEY 未配置' },
        { status: 500 }
      )
    }

    // 从 base64 中提取数据部分和 MIME 类型
    const base64Match = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
    let mimeType = 'image/jpeg'
    let base64Data = imageBase64

    if (base64Match) {
      mimeType = base64Match[1]
      base64Data = base64Match[2]
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
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: ANALYSIS_PROMPT,
                },
              ],
            },
          ],
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
      return Response.json(
        { error: `参考图分析失败: ${response.status}` },
        { status: response.status as number }
      )
    }

    const data = await response.json() as Record<string, unknown>

    // 提取文本响应
    const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined
    const analysisText = candidates?.[0]?.content?.parts?.[0]?.text

    if (!analysisText) {
      console.error('无法提取分析结果，完整响应:', data)
      return Response.json(
        { error: '未能从 API 响应中提取分析结果' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      analysis: analysisText.trim(),
    })

  } catch (error: unknown) {
    console.error('Reference Image Analysis Error:', error)
    const errorMessage = error instanceof Error ? error.message : '参考图分析失败'
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
