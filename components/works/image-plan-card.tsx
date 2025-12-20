'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, RefreshCw, X, Edit2 } from 'lucide-react'
import { ImageGenerator } from '@/components/image/ImageGenerator'
import { regeneratePlan } from '@/actions/creation'
import type { GenerationResult, ImagePlan } from '@/types/creation'

// 重新生成配图规划的原因选项
const IMAGE_REGENERATE_REASONS = [
  { value: 'type', label: '类型不合适' },
  { value: 'content', label: '内容描述不够具体' },
  { value: 'overlay', label: '文字叠加不好' },
  { value: 'other', label: '其他' },
]

interface ImagePlanCardProps {
  draftContent: GenerationResult
  isEditing?: boolean
  onContentChange?: (updates: Partial<GenerationResult>) => void
  onImageGenerated?: (index: number, imageUrl: string, imagePrompt: string, chuangkitDesignId?: string) => void
  faceSeed?: string
  onFaceSeedGenerated?: (seed: string) => void
  compact?: boolean
}

export function ImagePlanCard({
  draftContent,
  isEditing: externalEditing,
  onContentChange,
  onImageGenerated,
  faceSeed,
  onFaceSeedGenerated,
  compact = false,
}: ImagePlanCardProps) {
  // 内部编辑状态（如果没有外部控制）
  const [internalEditing, setInternalEditing] = useState(false)
  const isEditing = externalEditing !== undefined ? externalEditing : internalEditing
  const hasInternalEditControl = externalEditing === undefined

  // 编辑状态
  const [editedImages, setEditedImages] = useState<Array<{ type: string; content: string; overlay: string }>>(
    (draftContent.images || []).map(img => ({
      type: img.type || '',
      content: img.content || '',
      overlay: img.overlay || '',
    }))
  )

  // 重新生成状态
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null)
  const [showRegenDialog, setShowRegenDialog] = useState<number | null>(null)
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [error, setError] = useState('')

  if (!draftContent.images || draftContent.images.length === 0) return null

  const images = draftContent.images

  // 同步编辑内容到父组件
  function syncChanges() {
    if (onContentChange) {
      onContentChange({
        ...draftContent,
        images: images.map((img, i) => ({
          ...img,
          type: editedImages[i]?.type || img.type,
          content: editedImages[i]?.content || img.content,
          overlay: editedImages[i]?.overlay || img.overlay,
        })),
      })
    }
  }

  // 开始编辑
  function startEditing() {
    setEditedImages(images.map(img => ({
      type: img.type || '',
      content: img.content || '',
      overlay: img.overlay || '',
    })))
    setInternalEditing(true)
  }

  // 保存编辑
  function saveEditing() {
    syncChanges()
    setInternalEditing(false)
  }

  // 取消编辑
  function cancelEditing() {
    setEditedImages(images.map(img => ({
      type: img.type || '',
      content: img.content || '',
      overlay: img.overlay || '',
    })))
    setInternalEditing(false)
  }

  // 关闭重新生成对话框
  function closeRegenDialog() {
    setShowRegenDialog(null)
    setSelectedReason('')
    setCustomReason('')
  }

  // 重新生成配图规划
  async function handleRegenerate(index: number) {
    if (!selectedReason) return
    const reason = selectedReason === 'other'
      ? customReason
      : IMAGE_REGENERATE_REASONS.find(r => r.value === selectedReason)?.label || ''

    setShowRegenDialog(null)
    setRegeneratingIndex(index)
    setError('')

    try {
      const result = await regeneratePlan({
        planType: 'image',
        imageIndex: index,
        reason,
        context: {
          positioning: draftContent.positioning,
          title: draftContent.title,
          content: draftContent.content,
          cover: draftContent.cover,
          images: draftContent.images,
        },
      })

      if (result.success && result.plan) {
        const plan = result.plan
        // 更新编辑状态
        const newImages = [...editedImages]
        newImages[index] = {
          type: plan.type || editedImages[index]?.type || '',
          content: plan.content || editedImages[index]?.content || '',
          overlay: plan.overlay || '',
        }
        setEditedImages(newImages)

        // 通知父组件
        if (onContentChange) {
          onContentChange({
            ...draftContent,
            images: images.map((img, i) =>
              i === index
                ? {
                    ...img,
                    type: plan.type || img.type,
                    content: plan.content || img.content,
                    overlay: plan.overlay || img.overlay,
                  }
                : img
            ),
          })
        }
      } else {
        setError(result.error || '重新生成失败')
      }
    } catch (err) {
      console.error('重新生成配图规划失败:', err)
      setError('重新生成失败')
    } finally {
      setRegeneratingIndex(null)
      setSelectedReason('')
      setCustomReason('')
    }
  }

  // 处理图片生成
  function handleImageGenerated(index: number, imageUrl: string, imagePrompt: string, chuangkitDesignId?: string) {
    if (onImageGenerated) {
      onImageGenerated(index, imageUrl, imagePrompt, chuangkitDesignId)
    }
  }

  // 更新单张配图编辑状态
  function updateImage(index: number, field: 'type' | 'content' | 'overlay', value: string) {
    const newImages = [...editedImages]
    newImages[index] = { ...newImages[index], [field]: value }
    setEditedImages(newImages)
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">配图 ({images.length} 张)</CardTitle>
        {/* 内部编辑控制按钮 */}
        {hasInternalEditControl && (
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancelEditing}>
                  取消
                </Button>
                <Button size="sm" onClick={saveEditing}>
                  保存
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={startEditing} title="编辑">
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-red-500 bg-red-50 p-2 rounded-md">
            {error}
          </div>
        )}

        {images.map((img, i) => (
          <div key={i} className="flex gap-4 p-3 bg-muted/50 rounded-lg">
            {/* 左侧：图片生成 */}
            <div className={compact ? 'w-40 flex-shrink-0' : 'w-48 flex-shrink-0'}>
              <ImageGenerator
                prompt={editedImages[i]?.content || img.content}
                imageType="content"
                context={{
                  positioning: draftContent.positioning,
                  cover: draftContent.cover,
                  title: draftContent.title,
                  content: draftContent.content,
                  allImages: draftContent.images,
                  currentImage: {
                    index: img.index || i + 1,
                    type: editedImages[i]?.type || img.type,
                    content: editedImages[i]?.content || img.content,
                    overlay: editedImages[i]?.overlay || img.overlay,
                    tips: img.tips,
                  },
                }}
                onImageGenerated={(url, prompt, designId) => handleImageGenerated(i, url, prompt, designId)}
                initialImageUrl={img.imageUrl}
                initialPrompt={img.imagePrompt}
                initialDesignId={img.chuangkitDesignId}
                faceSeed={faceSeed}
                onFaceSeedGenerated={onFaceSeedGenerated}
                compact={compact}
              />
            </div>

            {/* 右侧：规划信息 */}
            <div className="flex-1 text-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">图 {img.index || i + 1}: {editedImages[i]?.type || img.type}</p>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRegenDialog(i)}
                    disabled={regeneratingIndex === i}
                    title="重新生成"
                    className="h-6 w-6 p-0"
                  >
                    {regeneratingIndex === i ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>

                  {/* 重新生成原因选择弹窗 */}
                  {showRegenDialog === i && (
                    <div className="absolute top-full right-0 mt-2 z-50 bg-white border rounded-lg shadow-lg p-4 w-64">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium">选择重新生成的原因：</p>
                        <button
                          onClick={closeRegenDialog}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {IMAGE_REGENERATE_REASONS.map(reason => (
                          <label key={reason.value} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name={`imageReason-${i}`}
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
                          onClick={closeRegenDialog}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={!selectedReason || (selectedReason === 'other' && !customReason)}
                          onClick={() => handleRegenerate(i)}
                        >
                          确定
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs font-semibold">类型</Label>
                    <Input
                      value={editedImages[i]?.type || ''}
                      onChange={(e) => updateImage(i, 'type', e.target.value)}
                      placeholder="配图类型"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">内容描述</Label>
                    <Textarea
                      value={editedImages[i]?.content || ''}
                      onChange={(e) => updateImage(i, 'content', e.target.value)}
                      placeholder="配图内容描述"
                      className="mt-1 min-h-[60px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">文字叠加</Label>
                    <Input
                      value={editedImages[i]?.overlay || ''}
                      onChange={(e) => updateImage(i, 'overlay', e.target.value)}
                      placeholder="图片上的文字"
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground">{editedImages[i]?.content || img.content}</p>
                  {(editedImages[i]?.overlay || img.overlay) && (
                    <p className="text-muted-foreground mt-1">文字：{editedImages[i]?.overlay || img.overlay}</p>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
