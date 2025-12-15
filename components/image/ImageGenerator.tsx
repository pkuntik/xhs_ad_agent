'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Sparkles, Download, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react'
import { uploadBase64Image } from '@/lib/utils/image'
import type { ImageFeedback, GenerationResult, ImagePlan, CreationFormData } from '@/types/creation'

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

interface ImageGeneratorProps {
  prompt: string
  imageType: 'cover' | 'content'
  context?: ImageGenerationContext
  onImageGenerated?: (imageUrl: string, imagePrompt: string) => void
  onFeedback?: (feedback: ImageFeedback) => void
  currentFeedback?: ImageFeedback
  aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
  initialImageUrl?: string
  initialPrompt?: string
  faceSeed?: string
  onFaceSeedGenerated?: (faceSeed: string) => void
  feedbackExamples?: Array<{ prompt: string; feedback: 'like' | 'dislike' }>
  compact?: boolean  // 紧凑模式，图片和按钮更小
}

export function ImageGenerator({
  prompt,
  imageType,
  context,
  onImageGenerated,
  onFeedback,
  currentFeedback,
  aspectRatio = '3:4',
  initialImageUrl,
  initialPrompt,
  faceSeed: initialFaceSeed,
  onFaceSeedGenerated,
  feedbackExamples: propFeedbackExamples,
  compact = false,
}: ImageGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isChangingFace, setIsChangingFace] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl || null)
  const [error, setError] = useState<string | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(initialPrompt || null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [feedback, setFeedback] = useState<ImageFeedback>(currentFeedback || null)
  const [faceSeed, setFaceSeed] = useState<string | null>(initialFaceSeed || null)
  const [createdBlobUrl, setCreatedBlobUrl] = useState<string | null>(null)

  React.useEffect(() => {
    if (initialImageUrl) {
      if (initialImageUrl.startsWith('data:')) {
        fetch(initialImageUrl)
          .then(r => r.blob())
          .then(blob => {
            const blobUrl = URL.createObjectURL(blob)

            if (createdBlobUrl && createdBlobUrl.startsWith('blob:')) {
              URL.revokeObjectURL(createdBlobUrl)
            }

            setCreatedBlobUrl(blobUrl)
            setImageUrl(blobUrl)
          })
          .catch(e => {
            console.error('Failed to convert initial base64 to blob:', e)
            setImageUrl(initialImageUrl)
          })
      } else {
        setImageUrl(initialImageUrl)
      }
    }
    if (initialPrompt) {
      setGeneratedPrompt(initialPrompt)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImageUrl, initialPrompt])

  React.useEffect(() => {
    return () => {
      if (createdBlobUrl && createdBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(createdBlobUrl)
      }
    }
  }, [createdBlobUrl])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请提供图片描述')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedPrompt(null)

    try {
      const feedbackExamples = propFeedbackExamples || []

      // 第一步: 生成图片提示词
      const promptResponse = await fetch('/api/image/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageType,
          context,
          feedbackExamples,
          faceSeed,
        }),
      })

      if (!promptResponse.ok) {
        const errorData = await promptResponse.json()
        throw new Error(errorData.error || '提示词生成失败')
      }

      const promptData = await promptResponse.json()
      const aiGeneratedPrompt = promptData.prompt
      const newFaceSeed = promptData.faceSeed

      setGeneratedPrompt(aiGeneratedPrompt)

      if (newFaceSeed && newFaceSeed !== faceSeed) {
        setFaceSeed(newFaceSeed)
        onFaceSeedGenerated?.(newFaceSeed)
      }

      // 第二步: 使用生成的提示词生成图片
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiGeneratedPrompt,
          imageType,
          context: {
            topic: context?.formData?.topic,
            contentType: context?.positioning?.contentType,
            keywords: context?.positioning?.keywords,
            targetAudience: context?.positioning?.targetAudience,
            tone: context?.positioning?.tone,
            coverCopywriting: context?.cover?.copywriting,
            colorScheme: context?.cover?.colorScheme,
            overlay: context?.currentImage?.overlay,
            imageContent: context?.currentImage?.content,
            imageIndex: context?.currentImage?.index,
            totalImages: context?.allImages?.length,
            contentStructure: context?.content?.structure,
            contentBody: context?.content?.body,
          },
          aspectRatio,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '图片生成失败')
      }

      const data = await response.json()

      if (data.success && data.imageUrl) {
        let finalImageUrl = data.imageUrl
        let displayImageUrl = data.imageUrl

        // 如果是 base64 图片，先上传到 OSS
        if (data.imageUrl.startsWith('data:')) {
          try {
            // 上传到 OSS 获取永久 URL
            const ossUrl = await uploadBase64Image(
              data.imageUrl,
              `${imageType}-${Date.now()}`
            )
            finalImageUrl = ossUrl

            // 为本地显示创建 blob URL
            const blob = await fetch(data.imageUrl).then(r => r.blob())
            const blobUrl = URL.createObjectURL(blob)

            if (createdBlobUrl && createdBlobUrl.startsWith('blob:')) {
              URL.revokeObjectURL(createdBlobUrl)
            }

            setCreatedBlobUrl(blobUrl)
            displayImageUrl = blobUrl
          } catch (e) {
            console.error('Failed to upload image to OSS:', e)
            // 上传失败时仍然使用原始 base64
            finalImageUrl = data.imageUrl
          }
        }

        setImageUrl(displayImageUrl)
        onImageGenerated?.(finalImageUrl, aiGeneratedPrompt)
      } else {
        throw new Error('未能获取图片 URL')
      }
    } catch (err: unknown) {
      console.error('Image generation error:', err)
      const errorMessage = err instanceof Error ? err.message : '图片生成失败'
      setError(errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async () => {
    if (!imageUrl) return

    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `xiaohongshu-${imageType}-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download error:', err)
    }
  }

  const handleFeedback = (newFeedback: ImageFeedback) => {
    const finalFeedback = feedback === newFeedback ? null : newFeedback
    setFeedback(finalFeedback)
    onFeedback?.(finalFeedback)
  }

  const handleChangeFace = async () => {
    setIsChangingFace(true)
    setError(null)

    try {
      const feedbackExamples = propFeedbackExamples || []

      const promptResponse = await fetch('/api/image/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageType,
          context,
          feedbackExamples,
          // 不传递 faceSeed，生成新的人脸种子
        }),
      })

      if (!promptResponse.ok) {
        const errorData = await promptResponse.json()
        throw new Error(errorData.error || '提示词生成失败')
      }

      const promptData = await promptResponse.json()
      const aiGeneratedPrompt = promptData.prompt
      const newFaceSeed = promptData.faceSeed

      setGeneratedPrompt(aiGeneratedPrompt)

      if (newFaceSeed) {
        setFaceSeed(newFaceSeed)
        onFaceSeedGenerated?.(newFaceSeed)
      }

      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiGeneratedPrompt,
          imageType,
          context: {
            topic: context?.formData?.topic,
            contentType: context?.positioning?.contentType,
            keywords: context?.positioning?.keywords,
            targetAudience: context?.positioning?.targetAudience,
            tone: context?.positioning?.tone,
            coverCopywriting: context?.cover?.copywriting,
            colorScheme: context?.cover?.colorScheme,
            overlay: context?.currentImage?.overlay,
            imageContent: context?.currentImage?.content,
            imageIndex: context?.currentImage?.index,
            totalImages: context?.allImages?.length,
            contentStructure: context?.content?.structure,
            contentBody: context?.content?.body,
          },
          aspectRatio,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '图片生成失败')
      }

      const data = await response.json()

      if (data.success && data.imageUrl) {
        let finalImageUrl = data.imageUrl
        let displayImageUrl = data.imageUrl

        // 如果是 base64 图片，先上传到 OSS
        if (data.imageUrl.startsWith('data:')) {
          try {
            // 上传到 OSS 获取永久 URL
            const ossUrl = await uploadBase64Image(
              data.imageUrl,
              `${imageType}-${Date.now()}`
            )
            finalImageUrl = ossUrl

            // 为本地显示创建 blob URL
            const blob = await fetch(data.imageUrl).then(r => r.blob())
            const blobUrl = URL.createObjectURL(blob)

            if (createdBlobUrl && createdBlobUrl.startsWith('blob:')) {
              URL.revokeObjectURL(createdBlobUrl)
            }

            setCreatedBlobUrl(blobUrl)
            displayImageUrl = blobUrl
          } catch (e) {
            console.error('Failed to upload image to OSS:', e)
            // 上传失败时仍然使用原始 base64
            finalImageUrl = data.imageUrl
          }
        }

        setImageUrl(displayImageUrl)
        onImageGenerated?.(finalImageUrl, aiGeneratedPrompt)
      } else {
        throw new Error('未能获取图片 URL')
      }
    } catch (err: unknown) {
      console.error('Change face error:', err)
      const errorMessage = err instanceof Error ? err.message : '切换人脸失败'
      setError(errorMessage)
    } finally {
      setIsChangingFace(false)
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {/* 已有图片时先显示图片 */}
      {imageUrl && compact && (
        <div className="relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
          <img
            src={imageUrl}
            alt={imageType === 'cover' ? 'AI 生成的封面图' : 'AI 生成的配图'}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className={compact ? "flex flex-wrap gap-1" : "flex gap-2"}>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || isChangingFace || !prompt.trim()}
          className={compact ? "flex-1" : "flex-1"}
          variant="outline"
          size="sm"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              {compact ? '生成中' : '生成中...'}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1" />
              {compact ? (imageUrl ? '重新生成' : '生成图片') : 'AI 生成图片'}
            </>
          )}
        </Button>

        {imageUrl && (
          <>
            {!compact && (
              <Button
                onClick={handleChangeFace}
                variant="outline"
                size="sm"
                disabled={isGenerating || isChangingFace}
                title="重新生成一个不同的人脸"
              >
                {isChangingFace ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    切换中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    换脸
                  </>
                )}
              </Button>
            )}
            <Button onClick={handleDownload} variant="outline" size="sm">
              <Download className="h-4 w-4" />
              {!compact && <span className="ml-2">下载</span>}
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className={`text-sm text-red-500 bg-red-50 rounded ${compact ? 'p-1 text-xs' : 'p-2'}`}>
          {error}
        </div>
      )}

      {generatedPrompt && !compact && (
        <div className="text-xs bg-blue-50 border border-blue-200 rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-blue-700">AI 生成的提示词:</span>
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="text-blue-600 hover:text-blue-800"
            >
              {showPrompt ? '隐藏' : '显示'}
            </button>
          </div>
          {showPrompt && (
            <p className="text-blue-600 leading-relaxed">
              {generatedPrompt}
            </p>
          )}
        </div>
      )}

      {imageUrl && !compact && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <img
              src={imageUrl}
              alt={imageType === 'cover' ? 'AI 生成的封面图' : 'AI 生成的配图'}
              className="w-full h-auto rounded-lg"
            />

            <div className="flex items-center justify-center gap-3 pt-2 border-t">
              <span className="text-xs text-muted-foreground">图片质量:</span>
              <Button
                variant={feedback === 'like' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFeedback('like')}
                className="flex items-center gap-1"
              >
                <ThumbsUp className={`h-4 w-4 ${feedback === 'like' ? 'fill-current' : ''}`} />
                <span className="text-xs">满意</span>
              </Button>
              <Button
                variant={feedback === 'dislike' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => handleFeedback('dislike')}
                className="flex items-center gap-1"
              >
                <ThumbsDown className={`h-4 w-4 ${feedback === 'dislike' ? 'fill-current' : ''}`} />
                <span className="text-xs">不满意</span>
              </Button>
            </div>

            {feedback === 'like' && (
              <p className="text-xs text-green-600 text-center">
                ✓ 已收集反馈，后续生成将参考此图片风格
              </p>
            )}
            {feedback === 'dislike' && (
              <p className="text-xs text-orange-600 text-center">
                ✓ 已收集反馈，后续生成将避免此类风格
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* compact 模式下的反馈按钮 */}
      {imageUrl && compact && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant={feedback === 'like' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFeedback('like')}
            className="h-7 px-2"
          >
            <ThumbsUp className={`h-3 w-3 ${feedback === 'like' ? 'fill-current' : ''}`} />
          </Button>
          <Button
            variant={feedback === 'dislike' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => handleFeedback('dislike')}
            className="h-7 px-2"
          >
            <ThumbsDown className={`h-3 w-3 ${feedback === 'dislike' ? 'fill-current' : ''}`} />
          </Button>
        </div>
      )}

      {/* compact 模式下没有图片时显示占位 */}
      {!imageUrl && compact && (
        <div className="aspect-[3/4] bg-muted/50 rounded-lg flex items-center justify-center">
          <span className="text-xs text-muted-foreground">点击生成图片</span>
        </div>
      )}
    </div>
  )
}
