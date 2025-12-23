'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, ImagePlus } from 'lucide-react'

// 预设的重新生成原因
export const REGENERATE_REASONS = [
  { value: 'style', label: '图片风格不对' },
  { value: 'face', label: '人物不好看' },
  { value: 'complex', label: '画面太复杂' },
  { value: 'color', label: '颜色不协调' },
  { value: 'text', label: '文字效果不好' },
  { value: 'composition', label: '构图不好' },
  { value: 'other', label: '其他' },
]

interface RegenerateDialogProps {
  selectedReason: string
  customReason: string
  referenceImagePreview: string | null
  isAnalyzingReference: boolean
  onReasonChange: (value: string) => void
  onCustomReasonChange: (value: string) => void
  onReferenceImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearReferenceImage: () => void
  onConfirm: () => void
  onCancel: () => void
}

export function RegenerateDialog({
  selectedReason,
  customReason,
  referenceImagePreview,
  isAnalyzingReference,
  onReasonChange,
  onCustomReasonChange,
  onReferenceImageUpload,
  onClearReferenceImage,
  onConfirm,
  onCancel,
}: RegenerateDialogProps) {
  const isConfirmDisabled = !selectedReason ||
    (selectedReason === 'other' && !customReason.trim()) ||
    isAnalyzingReference

  return (
    <div className="absolute top-full left-0 mt-2 z-50 bg-white border rounded-lg shadow-lg p-4 w-64">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">选择重新生成的原因：</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
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
              onChange={(e) => onReasonChange(e.target.value)}
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
          onChange={(e) => onCustomReasonChange(e.target.value)}
        />
      )}

      {/* 参考图上传区域 */}
      <div className="mt-3 pt-3 border-t">
        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
          <ImagePlus className="h-3 w-3" />
          上传参考图（可选）
        </p>
        {referenceImagePreview ? (
          <div className="relative h-20">
            <Image
              src={referenceImagePreview}
              alt="参考图"
              fill
              className="object-cover rounded border"
              unoptimized
            />
            <button
              onClick={onClearReferenceImage}
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
              onChange={onReferenceImageUpload}
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
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
          取消
        </Button>
        <Button size="sm" className="flex-1" onClick={onConfirm} disabled={isConfirmDisabled}>
          {isAnalyzingReference ? '分析参考图中...' : '重新生成'}
        </Button>
      </div>
    </div>
  )
}
