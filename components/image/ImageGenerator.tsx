'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, Sparkles, RefreshCw, X } from 'lucide-react'
import { uploadBase64Image } from '@/lib/utils/image'
import type { GenerationResult, ImagePlan, CreationFormData } from '@/types/creation'

// 预设的重新生成原因
const REGENERATE_REASONS = [
  { value: 'style', label: '图片风格不对' },
  { value: 'face', label: '人物不好看' },
  { value: 'complex', label: '画面太复杂' },
  { value: 'color', label: '颜色不协调' },
  { value: 'text', label: '文字效果不好' },
  { value: 'composition', label: '构图不好' },
  { value: 'other', label: '其他' },
]

interface FeedbackWithReason {
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
  feedbackExamples?: FeedbackWithReason[]
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

  // 重新生成原因选择相关状态
  const [showRegenDialog, setShowRegenDialog] = useState(false)
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [customReason, setCustomReason] = useState('')
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackWithReason[]>([])

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

  const handleGenerate = async (additionalFeedback?: FeedbackWithReason) => {
    if (!prompt.trim()) {
      setError('请提供图片描述')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedPrompt(null)

    try {
      // 合并 prop 传入的 feedbackExamples、历史反馈和本次反馈
      const allFeedback: FeedbackWithReason[] = [
        ...(propFeedbackExamples || []),
        ...feedbackHistory,
        ...(additionalFeedback ? [additionalFeedback] : []),
      ]

      // 第一步: 生成图片提示词
      const promptResponse = await fetch('/api/image/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageType,
          context,
          feedbackExamples: allFeedback,
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

  // 处理按钮点击 - 首次生成直接执行，重新生成时显示原因选择
  const handleButtonClick = () => {
    if (imageUrl && generatedPrompt) {
      // 已有图片，显示原因选择弹窗
      setShowRegenDialog(true)
    } else {
      // 首次生成，直接执行
      handleGenerate()
    }
  }

  // 确认重新生成
  const handleConfirmRegenerate = async () => {
    const reason = selectedReason === 'other'
      ? customReason
      : REGENERATE_REASONS.find(r => r.value === selectedReason)?.label || ''

    // 创建本次反馈
    const currentFeedback: FeedbackWithReason | undefined = generatedPrompt && reason
      ? { prompt: generatedPrompt, feedback: 'dislike', reason }
      : undefined

    // 将本次反馈添加到历史记录
    if (currentFeedback) {
      setFeedbackHistory(prev => [...prev, currentFeedback])
    }

    // 关闭弹窗并清空选择
    setShowRegenDialog(false)
    setSelectedReason('')
    setCustomReason('')

    // 执行生成，传入本次反馈
    await handleGenerate(currentFeedback)
  }

  // 取消重新生成
  const handleCancelRegenerate = () => {
    setShowRegenDialog(false)
    setSelectedReason('')
    setCustomReason('')
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

      <div className={compact ? "flex flex-wrap gap-1 relative" : "flex gap-2 relative"}>
        <Button
          onClick={handleButtonClick}
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

        {/* 重新生成原因选择弹窗 */}
        {showRegenDialog && (
          <div className="absolute top-full left-0 mt-2 z-50 bg-white border rounded-lg shadow-lg p-4 w-64">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">选择重新生成的原因：</p>
              <button
                onClick={handleCancelRegenerate}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {REGENERATE_REASONS.map(reason => (
                <label key={reason.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="accent-primary"
                  />
                  {reason.label}
                </label>
              ))}
            </div>
            {selectedReason === 'other' && (
              <Input
                className="mt-2"
                placeholder="请输入具体原因"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleCancelRegenerate}
              >
                取消
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleConfirmRegenerate}
                disabled={!selectedReason || (selectedReason === 'other' && !customReason.trim())}
              >
                重新生成
              </Button>
            </div>
          </div>
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
