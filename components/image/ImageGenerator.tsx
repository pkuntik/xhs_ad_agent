'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Sparkles, RefreshCw } from 'lucide-react'
import { uploadBase64Image } from '@/lib/utils/image'
import type { GenerationResult, ImagePlan, CreationFormData } from '@/types/creation'

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
          className="flex-1"
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

        {imageUrl && !compact && (
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
          <CardContent className="p-4">
            <img
              src={imageUrl}
              alt={imageType === 'cover' ? 'AI 生成的封面图' : 'AI 生成的配图'}
              className="w-full h-auto rounded-lg"
            />
          </CardContent>
        </Card>
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
