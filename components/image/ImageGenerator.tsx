'use client'

import React, { useState, useCallback } from 'react'
import { ChuangkitEditor } from './ChuangkitEditor'
import { useImageGenerator, type ImageGenerationContext, type FeedbackWithReason } from './useImageGenerator'
import { RegenerateDialog, REGENERATE_REASONS } from './RegenerateDialog'
import { ImagePreview } from './ImagePreview'
import { ZoomModal } from './ZoomModal'
import { GenerateButtons } from './GenerateButtons'
import { PromptDisplay } from './PromptDisplay'

interface ImageGeneratorProps {
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
  compact?: boolean
}

function ErrorDisplay({ error, compact }: { error: string | null; compact: boolean }) {
  if (!error) return null
  return (
    <div className={`text-sm text-red-500 bg-red-50 rounded ${compact ? 'p-1 text-xs' : 'p-2'}`}>
      {error}
    </div>
  )
}

function Placeholder() {
  return (
    <div className="aspect-[3/4] bg-muted/50 rounded-lg flex items-center justify-center">
      <span className="text-xs text-muted-foreground">点击生成图片</span>
    </div>
  )
}

function ConditionalPreview({ show, ...props }: { show: boolean } & React.ComponentProps<typeof ImagePreview>) {
  return show ? <ImagePreview {...props} /> : null
}

function ConditionalZoom({ show, ...props }: { show: boolean } & React.ComponentProps<typeof ZoomModal>) {
  return show ? <ZoomModal {...props} /> : null
}

export function ImageGenerator(props: ImageGeneratorProps) {
  const { prompt, imageType, compact = false } = props
  const g = useImageGenerator(props)

  const [showRegenDialog, setShowRegenDialog] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [showZoomModal, setShowZoomModal] = useState(false)
  const [showChuangkitEditor, setShowChuangkitEditor] = useState(false)

  const handleButtonClick = useCallback(() => {
    if (g.imageUrl && g.generatedPrompt) {
      setShowRegenDialog(true)
    } else {
      g.handleGenerate()
    }
  }, [g])

  const handleConfirmRegenerate = useCallback(async () => {
    const reason = selectedReason === 'other' ? customReason
      : REGENERATE_REASONS.find(r => r.value === selectedReason)?.label || ''
    setShowRegenDialog(false)
    setSelectedReason('')
    setCustomReason('')
    await g.regenerateWithFeedback(reason)
  }, [selectedReason, customReason, g])

  const resetDialog = useCallback(() => {
    setShowRegenDialog(false)
    setSelectedReason('')
    setCustomReason('')
    g.clearReferenceImage()
  }, [g])

  const openEditor = useCallback(() => setShowChuangkitEditor(true), [])
  const closeEditor = useCallback(() => setShowChuangkitEditor(false), [])
  const openZoom = useCallback(() => setShowZoomModal(true), [])
  const closeZoom = useCallback(() => setShowZoomModal(false), [])

  const onEditorComplete = useCallback((urls: string[], id?: string) => {
    if (urls.length > 0) g.updateImage(urls[0], id)
    closeEditor()
  }, [g, closeEditor])

  const onEditorError = useCallback((err: string) => { g.setError(err); closeEditor() }, [g, closeEditor])

  const hasImage = !!g.imageUrl

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <ConditionalPreview
        show={hasImage && compact} imageUrl={g.imageUrl!} imageType={imageType}
        isUploading={g.isUploading} uploadComplete={g.uploadComplete}
        compact onEdit={openEditor} onZoom={openZoom}
      />

      <div className={compact ? "flex flex-wrap gap-1 relative" : "flex gap-2 relative"}>
        <GenerateButtons
          isGenerating={g.isGenerating} isChangingFace={g.isChangingFace}
          hasImage={hasImage} hasPrompt={!!g.generatedPrompt}
          disabled={!prompt?.trim()} compact={compact}
          onGenerate={handleButtonClick} onChangeFace={g.handleChangeFace}
        />
        {showRegenDialog && (
          <RegenerateDialog
            selectedReason={selectedReason} customReason={customReason}
            referenceImagePreview={g.referenceImagePreview} isAnalyzingReference={g.isAnalyzingReference}
            onReasonChange={setSelectedReason} onCustomReasonChange={setCustomReason}
            onReferenceImageUpload={g.handleReferenceImageUpload} onClearReferenceImage={g.clearReferenceImage}
            onConfirm={handleConfirmRegenerate} onCancel={resetDialog}
          />
        )}
      </div>

      <ErrorDisplay error={g.error} compact={compact} />
      {g.generatedPrompt && !compact && <PromptDisplay prompt={g.generatedPrompt} />}

      <ConditionalPreview
        show={hasImage && !compact} imageUrl={g.imageUrl!} imageType={imageType}
        isUploading={g.isUploading} uploadComplete={g.uploadComplete}
        onEdit={openEditor} onZoom={openZoom}
      />

      {!hasImage && compact && <Placeholder />}

      <ConditionalZoom show={showZoomModal && hasImage} imageUrl={g.imageUrl!} imageType={imageType} onClose={closeZoom} />

      <ChuangkitEditor
        open={showChuangkitEditor} imageUrl={g.imageUrl || undefined}
        designId={g.chuangkitDesignId || undefined}
        onComplete={onEditorComplete} onClose={closeEditor} onError={onEditorError}
      />
    </div>
  )
}

export type { ImageGenerationContext, FeedbackWithReason }
