'use client'

import { useState, useEffect, useCallback } from 'react'
import { uploadBase64Image } from '@/lib/utils/image'
import { generateImage, generateImagePrompt, analyzeReferenceImage } from '@/actions/image'
import type { GenerationResult, ImagePlan, CreationFormData } from '@/types/creation'

// OSS 域名
const OSS_DOMAIN = 'ye.e-idear.com'

// 将图片上传到 OSS 并返回永久 URL
async function uploadImageToOSS(
  imageUrl: string,
  imageType: string
): Promise<{ ossUrl: string; displayUrl: string }> {
  if (imageUrl.startsWith('data:')) {
    const ossUrl = await uploadBase64Image(imageUrl, `${imageType}-${Date.now()}`)
    const blob = await fetch(imageUrl).then(r => r.blob())
    const displayUrl = URL.createObjectURL(blob)
    return { ossUrl, displayUrl }
  } else if (!imageUrl.includes(OSS_DOMAIN)) {
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const ossUrl = await uploadBase64Image(base64, `${imageType}-${Date.now()}`)
    const displayUrl = URL.createObjectURL(blob)
    return { ossUrl, displayUrl }
  } else {
    return { ossUrl: imageUrl, displayUrl: imageUrl }
  }
}

export interface FeedbackWithReason {
  prompt: string
  feedback: 'like' | 'dislike'
  reason?: string
}

export interface ImageGenerationContext {
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

// 移除 context 中的 base64 图片数据
function stripBase64Images(ctx: ImageGenerationContext | undefined): ImageGenerationContext | undefined {
  if (!ctx) return ctx
  const isBase64 = (url?: string) => url?.startsWith('data:')
  return {
    ...ctx,
    cover: ctx.cover ? {
      ...ctx.cover,
      imageUrl: isBase64(ctx.cover.imageUrl) ? undefined : ctx.cover.imageUrl,
    } : undefined,
    allImages: ctx.allImages?.map(img => ({
      ...img,
      imageUrl: isBase64(img.imageUrl) ? undefined : img.imageUrl,
    })),
  }
}

export interface UseImageGeneratorOptions {
  prompt: string
  imageType: 'cover' | 'content'
  context?: ImageGenerationContext
  onImageGenerated?: (imageUrl: string, imagePrompt: string, chuangkitDesignId?: string) => void
  aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
  initialImageUrl?: string
  initialPrompt?: string
  initialDesignId?: string
  faceSeed?: string
  onFaceSeedGenerated?: (faceSeed: string) => void
  feedbackExamples?: FeedbackWithReason[]
}

export function useImageGenerator(options: UseImageGeneratorOptions) {
  const {
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
  } = options

  // 核心状态
  const [isGenerating, setIsGenerating] = useState(false)
  const [isChangingFace, setIsChangingFace] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl || null)
  const [error, setError] = useState<string | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(initialPrompt || null)
  const [faceSeed, setFaceSeed] = useState<string | null>(initialFaceSeed || null)
  const [createdBlobUrl, setCreatedBlobUrl] = useState<string | null>(null)
  const [chuangkitDesignId, setChuangkitDesignId] = useState<string | null>(initialDesignId || null)

  // 上传状态
  const [isUploading, setIsUploading] = useState(false)
  const [uploadComplete, setUploadComplete] = useState(false)

  // 反馈历史
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackWithReason[]>([])

  // 参考图状态
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null)
  const [isAnalyzingReference, setIsAnalyzingReference] = useState(false)

  // 上传完成后自动隐藏提示
  useEffect(() => {
    if (uploadComplete) {
      const timer = setTimeout(() => setUploadComplete(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [uploadComplete])

  // 初始化图片
  useEffect(() => {
    if (initialImageUrl) {
      if (initialImageUrl.startsWith('data:')) {
        fetch(initialImageUrl)
          .then(r => r.blob())
          .then(blob => {
            const blobUrl = URL.createObjectURL(blob)
            if (createdBlobUrl?.startsWith('blob:')) {
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

  // 清理 blob URLs
  useEffect(() => {
    return () => {
      if (createdBlobUrl?.startsWith('blob:')) URL.revokeObjectURL(createdBlobUrl)
      if (referenceImagePreview?.startsWith('blob:')) URL.revokeObjectURL(referenceImagePreview)
    }
  }, [createdBlobUrl, referenceImagePreview])

  // 处理参考图上传
  const handleReferenceImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [])

  // 清除参考图
  const clearReferenceImage = useCallback(() => {
    setReferenceImage(null)
    if (referenceImagePreview) {
      URL.revokeObjectURL(referenceImagePreview)
      setReferenceImagePreview(null)
    }
  }, [referenceImagePreview])

  // 生成图片
  const handleGenerate = useCallback(async (
    additionalFeedback?: FeedbackWithReason,
    referenceImageAnalysis?: string
  ) => {
    if (!prompt?.trim()) {
      setError('请提供图片描述')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedPrompt(null)

    try {
      const allFeedback: FeedbackWithReason[] = [
        ...(propFeedbackExamples || []),
        ...feedbackHistory,
        ...(additionalFeedback ? [additionalFeedback] : []),
      ]

      const promptResult = await generateImagePrompt({
        imageType,
        context: stripBase64Images(context) || {},
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

      const rawImageUrl = imageResult.imageUrl

      let displayUrl = rawImageUrl
      if (rawImageUrl.startsWith('data:')) {
        const blob = await fetch(rawImageUrl).then(r => r.blob())
        displayUrl = URL.createObjectURL(blob)
        if (createdBlobUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(createdBlobUrl)
        }
        setCreatedBlobUrl(displayUrl)
      }

      setImageUrl(displayUrl)
      setChuangkitDesignId(null)
      setIsGenerating(false)

      setIsUploading(true)
      setUploadComplete(false)

      try {
        const { ossUrl } = await uploadImageToOSS(rawImageUrl, imageType)
        setUploadComplete(true)
        onImageGenerated?.(ossUrl, aiGeneratedPrompt)
      } catch (uploadErr) {
        console.error('OSS upload error:', uploadErr)
        onImageGenerated?.(rawImageUrl, aiGeneratedPrompt)
      } finally {
        setIsUploading(false)
      }
    } catch (err: unknown) {
      console.error('Image generation error:', err)
      setError(err instanceof Error ? err.message : '图片生成失败')
      setIsGenerating(false)
    }
  }, [prompt, imageType, context, aspectRatio, faceSeed, propFeedbackExamples, feedbackHistory, createdBlobUrl, onImageGenerated, onFaceSeedGenerated])

  // 换脸
  const handleChangeFace = useCallback(async () => {
    setIsChangingFace(true)
    setError(null)

    try {
      const promptResult = await generateImagePrompt({
        imageType,
        context: stripBase64Images(context) || {},
        feedbackExamples: propFeedbackExamples || [],
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

      const rawImageUrl = imageResult.imageUrl

      let displayUrl = rawImageUrl
      if (rawImageUrl.startsWith('data:')) {
        const blob = await fetch(rawImageUrl).then(r => r.blob())
        displayUrl = URL.createObjectURL(blob)
        if (createdBlobUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(createdBlobUrl)
        }
        setCreatedBlobUrl(displayUrl)
      }

      setImageUrl(displayUrl)
      setChuangkitDesignId(null)
      setIsChangingFace(false)

      setIsUploading(true)
      setUploadComplete(false)

      try {
        const { ossUrl } = await uploadImageToOSS(rawImageUrl, imageType)
        setUploadComplete(true)
        onImageGenerated?.(ossUrl, aiGeneratedPrompt)
      } catch (uploadErr) {
        console.error('OSS upload error:', uploadErr)
        onImageGenerated?.(rawImageUrl, aiGeneratedPrompt)
      } finally {
        setIsUploading(false)
      }
    } catch (err: unknown) {
      console.error('Change face error:', err)
      setError(err instanceof Error ? err.message : '切换人脸失败')
      setIsChangingFace(false)
    }
  }, [imageType, context, aspectRatio, propFeedbackExamples, createdBlobUrl, onImageGenerated, onFaceSeedGenerated])

  // 分析参考图并重新生成
  const regenerateWithFeedback = useCallback(async (reason: string) => {
    const currentFeedback: FeedbackWithReason | undefined = generatedPrompt && reason
      ? { prompt: generatedPrompt, feedback: 'dislike', reason }
      : undefined

    if (currentFeedback) {
      setFeedbackHistory(prev => [...prev, currentFeedback])
    }

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

    clearReferenceImage()
    await handleGenerate(currentFeedback, analysisResult)
  }, [generatedPrompt, referenceImage, clearReferenceImage, handleGenerate])

  // 更新图片 (来自创客贴编辑器)
  const updateImage = useCallback((newImageUrl: string, newDesignId?: string) => {
    setImageUrl(newImageUrl)
    if (newDesignId) {
      setChuangkitDesignId(newDesignId)
    }
    if (generatedPrompt) {
      onImageGenerated?.(newImageUrl, generatedPrompt, newDesignId)
    }
  }, [generatedPrompt, onImageGenerated])

  return {
    // 状态
    isGenerating,
    isChangingFace,
    imageUrl,
    error,
    generatedPrompt,
    chuangkitDesignId,
    isUploading,
    uploadComplete,
    referenceImagePreview,
    isAnalyzingReference,
    // 操作
    handleGenerate,
    handleChangeFace,
    regenerateWithFeedback,
    handleReferenceImageUpload,
    clearReferenceImage,
    updateImage,
    setError,
  }
}
