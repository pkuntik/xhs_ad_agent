'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, RefreshCw, X, Edit2, Eye } from 'lucide-react'
import { ImageGenerator } from '@/components/image/ImageGenerator'
import { regeneratePlan } from '@/actions/creation'
import type { GenerationResult } from '@/types/creation'

// 重新生成封面规划的原因选项
const COVER_REGENERATE_REASONS = [
  { value: 'type', label: '类型不合适' },
  { value: 'content', label: '内容描述不好' },
  { value: 'overlay', label: '文案不够吸引人' },
  { value: 'colorScheme', label: '配色不协调' },
  { value: 'other', label: '其他' },
]

interface CoverPlanCardProps {
  draftContent: GenerationResult
  isEditing?: boolean
  onContentChange?: (updates: Partial<GenerationResult>) => void
  onImageGenerated?: (imageUrl: string, imagePrompt: string, chuangkitDesignId?: string) => void
  faceSeed?: string
  onFaceSeedGenerated?: (seed: string) => void
  compact?: boolean
}

export function CoverPlanCard({
  draftContent,
  isEditing: externalEditing,
  onContentChange,
  onImageGenerated,
  faceSeed,
  onFaceSeedGenerated,
  compact = false,
}: CoverPlanCardProps) {
  // 内部编辑状态（如果没有外部控制）
  const [internalEditing, setInternalEditing] = useState(false)
  const isEditing = externalEditing !== undefined ? externalEditing : internalEditing
  const hasInternalEditControl = externalEditing === undefined

  // 编辑状态
  const [editedType, setEditedType] = useState(draftContent.cover?.type || '')
  const [editedContent, setEditedContent] = useState(draftContent.cover?.content || '')
  const [editedOverlay, setEditedOverlay] = useState(draftContent.cover?.overlay || '')
  const [editedColorScheme, setEditedColorScheme] = useState(draftContent.cover?.colorScheme || '')

  // 重新生成状态
  const [regenerating, setRegenerating] = useState(false)
  const [showRegenDialog, setShowRegenDialog] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [error, setError] = useState('')

  if (!draftContent.cover) return null

  const cover = draftContent.cover

  // 同步编辑内容到父组件
  function syncChanges() {
    if (onContentChange) {
      onContentChange({
        ...draftContent,
        cover: {
          ...cover,
          type: editedType,
          content: editedContent,
          overlay: editedOverlay,
          colorScheme: editedColorScheme,
        },
      })
    }
  }

  // 开始编辑
  function startEditing() {
    setEditedType(cover.type || '')
    setEditedContent(cover.content || '')
    setEditedOverlay(cover.overlay || '')
    setEditedColorScheme(cover.colorScheme || '')
    setInternalEditing(true)
  }

  // 保存编辑
  function saveEditing() {
    syncChanges()
    setInternalEditing(false)
  }

  // 取消编辑
  function cancelEditing() {
    setEditedType(cover.type || '')
    setEditedContent(cover.content || '')
    setEditedOverlay(cover.overlay || '')
    setEditedColorScheme(cover.colorScheme || '')
    setInternalEditing(false)
  }

  // 关闭重新生成对话框
  function closeRegenDialog() {
    setShowRegenDialog(false)
    setSelectedReason('')
    setCustomReason('')
  }

  // 重新生成封面规划
  async function handleRegenerate() {
    if (!selectedReason) return
    const reason = selectedReason === 'other'
      ? customReason
      : COVER_REGENERATE_REASONS.find(r => r.value === selectedReason)?.label || ''

    setShowRegenDialog(false)
    setRegenerating(true)
    setError('')

    try {
      const result = await regeneratePlan({
        planType: 'cover',
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
        // 更新编辑状态
        setEditedType(result.plan.type || '')
        setEditedContent(result.plan.content || '')
        setEditedOverlay(result.plan.overlay || '')
        setEditedColorScheme(result.plan.colorScheme || '')

        // 通知父组件
        if (onContentChange) {
          onContentChange({
            ...draftContent,
            cover: {
              ...cover,
              type: result.plan.type || cover.type,
              content: result.plan.content || cover.content,
              overlay: result.plan.overlay || cover.overlay,
              colorScheme: result.plan.colorScheme || cover.colorScheme,
            },
          })
        }
      } else {
        setError(result.error || '重新生成失败')
      }
    } catch (err) {
      console.error('重新生成封面规划失败:', err)
      setError('重新生成失败')
    } finally {
      setRegenerating(false)
      setSelectedReason('')
      setCustomReason('')
    }
  }

  // 处理图片生成
  function handleImageGenerated(imageUrl: string, imagePrompt: string, chuangkitDesignId?: string) {
    if (onImageGenerated) {
      onImageGenerated(imageUrl, imagePrompt, chuangkitDesignId)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">封面规划</CardTitle>
        <div className="flex items-center gap-1">
          {/* 内部编辑控制按钮 */}
          {hasInternalEditControl && (
            isEditing ? (
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
            )
          )}
          {/* 重新生成按钮 */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRegenDialog(true)}
              disabled={regenerating}
              title="重新生成"
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>

            {/* 重新生成原因选择弹窗 */}
            {showRegenDialog && (
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
                  {COVER_REGENERATE_REASONS.map(reason => (
                    <label key={reason.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="coverReason"
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
                    onClick={handleRegenerate}
                  >
                    确定
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="text-sm text-red-500 bg-red-50 p-2 rounded-md mb-3">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          {/* 左侧：图片生成 */}
          <div className={compact ? 'w-40 flex-shrink-0' : 'w-48 flex-shrink-0'}>
            <ImageGenerator
              prompt={editedContent || cover.content}
              imageType="cover"
              context={{
                positioning: draftContent.positioning,
                cover: cover,
                title: draftContent.title,
                content: draftContent.content,
                allImages: draftContent.images,
              }}
              onImageGenerated={handleImageGenerated}
              initialImageUrl={cover.imageUrl}
              initialPrompt={cover.imagePrompt}
              initialDesignId={cover.chuangkitDesignId}
              faceSeed={faceSeed}
              onFaceSeedGenerated={onFaceSeedGenerated}
              compact={compact}
            />
          </div>

          {/* 右侧：规划信息 */}
          <div className="flex-1 space-y-2 text-sm">
            {isEditing ? (
              <>
                <div>
                  <Label className="text-xs font-semibold">类型</Label>
                  <Input
                    value={editedType}
                    onChange={(e) => setEditedType(e.target.value)}
                    placeholder="封面类型"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">主视觉</Label>
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    placeholder="主视觉描述"
                    className="mt-1 min-h-[60px]"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">文案</Label>
                  <Textarea
                    value={editedOverlay}
                    onChange={(e) => setEditedOverlay(e.target.value)}
                    placeholder="封面文案"
                    className="mt-1 min-h-[60px]"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">配色</Label>
                  <Input
                    value={editedColorScheme}
                    onChange={(e) => setEditedColorScheme(e.target.value)}
                    placeholder="配色方案"
                    className="mt-1"
                  />
                </div>
              </>
            ) : (
              <>
                <p><strong>类型：</strong>{editedType || cover.type}</p>
                <p><strong>主视觉：</strong>{editedContent || cover.content}</p>
                <p><strong>文案：</strong>{editedOverlay || cover.overlay}</p>
                <p><strong>配色：</strong>{editedColorScheme || cover.colorScheme}</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
