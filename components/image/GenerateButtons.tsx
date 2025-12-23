'use client'

import { Button } from '@/components/ui/button'
import { Loader2, Sparkles, RefreshCw } from 'lucide-react'

interface GenerateButtonsProps {
  isGenerating: boolean
  isChangingFace: boolean
  hasImage: boolean
  hasPrompt: boolean
  disabled: boolean
  compact: boolean
  onGenerate: () => void
  onChangeFace: () => void
}

export function GenerateButtons({
  isGenerating,
  isChangingFace,
  hasImage,
  hasPrompt,
  disabled,
  compact,
  onGenerate,
  onChangeFace,
}: GenerateButtonsProps) {
  return (
    <>
      <Button
        onClick={onGenerate}
        disabled={isGenerating || isChangingFace || disabled}
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
            {compact ? (hasImage ? '重新生成' : '生成图片') : 'AI 生成图片'}
          </>
        )}
      </Button>

      {hasImage && hasPrompt && !compact && (
        <Button
          onClick={onChangeFace}
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
    </>
  )
}
