'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, Sparkles, RefreshCw, X, ImagePlus, ZoomIn, Pencil } from 'lucide-react'
import { uploadBase64Image } from '@/lib/utils/image'
import { ChuangkitEditor } from './ChuangkitEditor'
import { generateImage, generateImagePrompt, analyzeReferenceImage } from '@/actions/image'
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
    tips?: string
  }
  visualStyle?: string
}

interface ImageGeneratorProps {
  prompt: string
  imageType: 'cover' | 'content'
  context?: ImageGenerationContext
  onImageGenerated?: (imageUrl: string, imagePrompt: string, chuangkitDesignId?: string) => void
  aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
  initialImageUrl?: string
  initialPrompt?: string
  initialDesignId?: string  // 创客贴设计稿 ID
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
  initialDesignId,
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
  const [chuangkitDesignId, setChuangkitDesignId] = useState<string | null>(initialDesignId || null)

  // 重新生成原因选择相关状态
  const [showRegenDialog, setShowRegenDialog] = useState(false)
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [customReason, setCustomReason] = useState('')
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackWithReason[]>([])

  // 参考图相关状态
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null)
  const [isAnalyzingReference, setIsAnalyzingReference] = useState(false)

  // 图片放大查看状态
  const [showZoomModal, setShowZoomModal] = useState(false)

  // 创客贴编辑器状态
  const [showChuangkitEditor, setShowChuangkitEditor] = useState(false)

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
      if (referenceImagePreview && referenceImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(referenceImagePreview)
      }
    }
  }, [createdBlobUrl, referenceImagePreview])

  // 处理参考图上传
  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        setReferenceImage(base64)
        setReferenceImagePreview(URL.createObjectURL(file))
      }
      reader.readAsDataURL(file)
    }
  }

  // 清除参考图
  const clearReferenceImage = () => {
    setReferenceImage(null)
    if (referenceImagePreview) {
      URL.revokeObjectURL(referenceImagePreview)
      setReferenceImagePreview(null)
    }
  }

  const handleGenerate = async (additionalFeedback?: FeedbackWithReason, referenceImageAnalysis?: string) => {
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
      const promptResult = await generateImagePrompt({
        imageType,
        context: context || {},
        feedbackExamples: allFeedback,
        faceSeed: faceSeed || undefined,
        referenceImageAnalysis,
      })

      if (!promptResult.success || !promptResult.prompt) {
        throw new Error(promptResult.error || '提示词生成失败')
      }

      const aiGeneratedPrompt = promptResult.prompt
      const newFaceSeed = promptResult.faceSeed

      setGeneratedPrompt(aiGeneratedPrompt)

      if (newFaceSeed && newFaceSeed !== faceSeed) {
        setFaceSeed(newFaceSeed)
        onFaceSeedGenerated?.(newFaceSeed)
      }

      // 第二步: 使用生成的提示词生成图片
      const imageResult = await generateImage({
        prompt: aiGeneratedPrompt,
        imageType,
        context: {
          topic: context?.formData?.topic,
          contentType: context?.positioning?.contentType,
          keywords: context?.positioning?.keywords,
          targetAudience: context?.positioning?.targetAudience,
          tone: context?.positioning?.tone,
          coverOverlay: context?.cover?.overlay,
          colorScheme: context?.cover?.colorScheme,
          overlay: context?.currentImage?.overlay,
          imageContent: context?.currentImage?.content,
          imageIndex: context?.currentImage?.index,
          totalImages: context?.allImages?.length,
          contentStructure: context?.content?.structure,
          contentBody: context?.content?.body,
        },
        aspectRatio,
      })

      if (!imageResult.success || !imageResult.imageUrl) {
        throw new Error(imageResult.error || '图片生成失败')
      }

      let finalImageUrl = imageResult.imageUrl
      let displayImageUrl = imageResult.imageUrl

      // 如果是 base64 图片，先上传到 OSS
      if (imageResult.imageUrl.startsWith('data:')) {
        try {
          // 上传到 OSS 获取永久 URL
          const ossUrl = await uploadBase64Image(
            imageResult.imageUrl,
            `${imageType}-${Date.now()}`
          )
          finalImageUrl = ossUrl

          // 为本地显示创建 blob URL
          const blob = await fetch(imageResult.imageUrl).then(r => r.blob())
          const blobUrl = URL.createObjectURL(blob)

          if (createdBlobUrl && createdBlobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(createdBlobUrl)
          }

          setCreatedBlobUrl(blobUrl)
          displayImageUrl = blobUrl
        } catch (e) {
          console.error('Failed to upload image to OSS:', e)
          // 上传失败时仍然使用原始 base64
          finalImageUrl = imageResult.imageUrl
        }
      }

      setImageUrl(displayImageUrl)
      // 新生成的图片清除旧的设计稿 ID（因为是全新的图片）
      setChuangkitDesignId(null)
      onImageGenerated?.(finalImageUrl, aiGeneratedPrompt)
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

      const promptResult = await generateImagePrompt({
        imageType,
        context: context || {},
        feedbackExamples,
        // 不传递 faceSeed，生成新的人脸种子
      })

      if (!promptResult.success || !promptResult.prompt) {
        throw new Error(promptResult.error || '提示词生成失败')
      }

      const aiGeneratedPrompt = promptResult.prompt
      const newFaceSeed = promptResult.faceSeed

      setGeneratedPrompt(aiGeneratedPrompt)

      if (newFaceSeed) {
        setFaceSeed(newFaceSeed)
        onFaceSeedGenerated?.(newFaceSeed)
      }

      const imageResult = await generateImage({
        prompt: aiGeneratedPrompt,
        imageType,
        context: {
          topic: context?.formData?.topic,
          contentType: context?.positioning?.contentType,
          keywords: context?.positioning?.keywords,
          targetAudience: context?.positioning?.targetAudience,
          tone: context?.positioning?.tone,
          coverOverlay: context?.cover?.overlay,
          colorScheme: context?.cover?.colorScheme,
          overlay: context?.currentImage?.overlay,
          imageContent: context?.currentImage?.content,
          imageIndex: context?.currentImage?.index,
          totalImages: context?.allImages?.length,
          contentStructure: context?.content?.structure,
          contentBody: context?.content?.body,
        },
        aspectRatio,
      })

      if (!imageResult.success || !imageResult.imageUrl) {
        throw new Error(imageResult.error || '图片生成失败')
      }

      let finalImageUrl = imageResult.imageUrl
      let displayImageUrl = imageResult.imageUrl

      // 如果是 base64 图片，先上传到 OSS
      if (imageResult.imageUrl.startsWith('data:')) {
        try {
          // 上传到 OSS 获取永久 URL
          const ossUrl = await uploadBase64Image(
            imageResult.imageUrl,
            `${imageType}-${Date.now()}`
          )
          finalImageUrl = ossUrl

          // 为本地显示创建 blob URL
          const blob = await fetch(imageResult.imageUrl).then(r => r.blob())
          const blobUrl = URL.createObjectURL(blob)

          if (createdBlobUrl && createdBlobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(createdBlobUrl)
          }

          setCreatedBlobUrl(blobUrl)
          displayImageUrl = blobUrl
        } catch (e) {
          console.error('Failed to upload image to OSS:', e)
          // 上传失败时仍然使用原始 base64
          finalImageUrl = imageResult.imageUrl
        }
      }

      setImageUrl(displayImageUrl)
      // 新生成的图片清除旧的设计稿 ID（因为是全新的图片）
      setChuangkitDesignId(null)
      onImageGenerated?.(finalImageUrl, aiGeneratedPrompt)
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

    // 如果有参考图，先分析
    let analysisResult: string | undefined
    if (referenceImage) {
      setIsAnalyzingReference(true)
      try {
        const analyzeResult = await analyzeReferenceImage(referenceImage)
        if (analyzeResult.success && analyzeResult.analysis) {
          analysisResult = analyzeResult.analysis
        }
      } catch (e) {
        console.error('Failed to analyze reference image:', e)
      } finally {
        setIsAnalyzingReference(false)
      }
    }

    // 清除参考图（已分析完毕）
    clearReferenceImage()

    // 执行生成，传入本次反馈和参考图分析结果
    await handleGenerate(currentFeedback, analysisResult)
  }

  // 取消重新生成
  const handleCancelRegenerate = () => {
    setShowRegenDialog(false)
    setSelectedReason('')
    setCustomReason('')
    clearReferenceImage()
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {/* 已有图片时先显示图片 */}
      {imageUrl && compact && (
        <div className="relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden group">
          <img
            src={imageUrl}
            alt={imageType === 'cover' ? 'AI 生成的封面图' : 'AI 生成的配图'}
            className="w-full h-full object-contain"
          />
          {/* 操作按钮 */}
          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowChuangkitEditor(true)}
              className="p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
              title="编辑图片"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowZoomModal(true)}
              className="p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
              title="查看大图"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
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
            {/* 参考图上传区域 */}
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <ImagePlus className="h-3 w-3" />
                上传参考图（可选）
              </p>
              {referenceImagePreview ? (
                <div className="relative">
                  <img
                    src={referenceImagePreview}
                    alt="参考图"
                    className="w-full h-20 object-cover rounded border"
                  />
                  <button
                    onClick={clearReferenceImage}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="block w-full h-16 border-2 border-dashed rounded cursor-pointer hover:border-primary/50 hover:bg-gray-50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleReferenceImageUpload}
                  />
                  <div className="h-full flex items-center justify-center text-xs text-gray-400">
                    点击上传图片
                  </div>
                </label>
              )}
              <p className="text-xs text-gray-400 mt-1">
                我会分析参考图的风格来改进生成
              </p>
            </div>
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
                disabled={!selectedReason || (selectedReason === 'other' && !customReason.trim()) || isAnalyzingReference}
              >
                {isAnalyzingReference ? '分析参考图中...' : '重新生成'}
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
            <div className="relative group">
              <img
                src={imageUrl}
                alt={imageType === 'cover' ? 'AI 生成的封面图' : 'AI 生成的配图'}
                className="w-full h-auto rounded-lg"
              />
              {/* 操作按钮 */}
              <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setShowChuangkitEditor(true)}
                  className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
                  title="编辑图片"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowZoomModal(true)}
                  className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
                  title="查看大图"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* compact 模式下没有图片时显示占位 */}
      {!imageUrl && compact && (
        <div className="aspect-[3/4] bg-muted/50 rounded-lg flex items-center justify-center">
          <span className="text-xs text-muted-foreground">点击生成图片</span>
        </div>
      )}

      {/* 图片放大模态框 */}
      {showZoomModal && imageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowZoomModal(false)}
        >
          <button
            onClick={() => setShowZoomModal(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={imageUrl}
            alt={imageType === 'cover' ? 'AI 生成的封面图' : 'AI 生成的配图'}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 创客贴编辑器 */}
      <ChuangkitEditor
        open={showChuangkitEditor}
        imageUrl={imageUrl || undefined}
        designId={chuangkitDesignId || undefined}
        onComplete={async (imageUrls, newDesignId) => {
          if (imageUrls.length > 0) {
            const newImageUrl = imageUrls[0]
            setImageUrl(newImageUrl)
            // 保存设计稿 ID
            if (newDesignId) {
              setChuangkitDesignId(newDesignId)
            }
            // 通知父组件图片已更新（包含设计稿 ID）
            if (generatedPrompt) {
              onImageGenerated?.(newImageUrl, generatedPrompt, newDesignId)
            }
          }
          setShowChuangkitEditor(false)
        }}
        onClose={() => setShowChuangkitEditor(false)}
        onError={(error) => {
          console.error('Chuangkit Editor Error:', error)
          setError(error)
          setShowChuangkitEditor(false)
        }}
      />
    </div>
  )
}
