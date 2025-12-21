'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Edit2, Copy, Check, Loader2 } from 'lucide-react'

interface ContentCardProps {
  type: 'title' | 'content' | 'topics'
  title: string
  value: string
  placeholder?: string
  isEditing?: boolean
  onChange?: (value: string) => void
  onSave?: (value: string) => Promise<void>  // 保存回调，确认编辑时调用
  multiline?: boolean
  showTags?: boolean
  maxLength?: number  // 最大长度限制
  showCopy?: boolean  // 是否显示复制按钮
  showWordCount?: boolean  // 是否显示字数（用于正文）
}

export function ContentCard({
  type,
  title,
  value,
  placeholder,
  isEditing: externalEditing,
  onChange,
  onSave,
  multiline = false,
  showTags = false,
  maxLength,
  showCopy = false,
  showWordCount = false,
}: ContentCardProps) {
  // 标题默认限制20字符
  const effectiveMaxLength = type === 'title' ? (maxLength ?? 20) : maxLength
  // 内部编辑状态（如果没有外部控制）
  const [internalEditing, setInternalEditing] = useState(false)
  const isEditing = externalEditing !== undefined ? externalEditing : internalEditing
  const hasInternalEditControl = externalEditing === undefined

  // 编辑状态
  const [editedValue, setEditedValue] = useState(value)

  // 复制状态
  const [copied, setCopied] = useState(false)

  // 保存状态
  const [saving, setSaving] = useState(false)

  // 开始编辑
  function startEditing() {
    setEditedValue(value)
    setInternalEditing(true)
  }

  // 保存编辑
  async function saveEditing() {
    if (onChange) {
      onChange(editedValue)
    }
    if (onSave) {
      setSaving(true)
      try {
        await onSave(editedValue)
      } finally {
        setSaving(false)
      }
    }
    setInternalEditing(false)
  }

  // 取消编辑
  function cancelEditing() {
    setEditedValue(value)
    setInternalEditing(false)
  }

  // 处理输入变化
  function handleChange(newValue: string) {
    setEditedValue(newValue)
    if (externalEditing !== undefined && onChange) {
      onChange(newValue)
    }
  }

  // 复制内容
  function handleCopy() {
    const textToCopy = showTags
      ? (editedValue || value).split(/\s+/).filter(Boolean).join(' ')
      : (editedValue || value)
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 渲染标签
  function renderTags() {
    const tags = (editedValue || value).split(/\s+/).filter(Boolean)
    return (
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="px-2 py-1 bg-primary/10 text-primary rounded-full text-sm"
          >
            #{tag}
          </span>
        ))}
        {tags.length === 0 && (
          <span className="text-muted-foreground">暂无话题标签</span>
        )}
      </div>
    )
  }

  // 计算显示的标题（可能包含字数）
  const displayTitle = showWordCount
    ? `${title} (${(editedValue || value).length} 字)`
    : title

  return (
    <Card className="group">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {displayTitle}
          {effectiveMaxLength && (
            <span className={`ml-2 text-xs font-normal ${(editedValue || value).length > effectiveMaxLength ? 'text-red-500' : 'text-muted-foreground'}`}>
              ({(editedValue || value).length}/{effectiveMaxLength})
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          {/* 内部编辑控制按钮 */}
          {hasInternalEditControl && (
            isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={saving}>
                  取消
                </Button>
                <Button variant="ghost" size="sm" onClick={saveEditing} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startEditing}
                  title="编辑"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                {showCopy && (
                  <Button variant="ghost" size="sm" onClick={handleCopy} title="复制">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </>
            )
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isEditing ? (
          multiline ? (
            <Textarea
              value={editedValue}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={placeholder}
              className="min-h-[200px] resize-y"
              style={{ height: Math.max(200, (editedValue.split('\n').length + 1) * 24) + 'px' }}
            />
          ) : (
            <div className="space-y-1">
              <Input
                value={editedValue}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={placeholder}
                maxLength={effectiveMaxLength}
              />
              {effectiveMaxLength && (editedValue || value).length > effectiveMaxLength && (
                <p className="text-xs text-red-500">
                  超过{effectiveMaxLength}字，发布时会自动截断
                </p>
              )}
            </div>
          )
        ) : showTags ? (
          renderTags()
        ) : multiline ? (
          <div className="whitespace-pre-wrap text-sm min-h-[100px]">
            {editedValue || value || '暂无内容'}
          </div>
        ) : (
          <p className="font-medium">{editedValue || value || '暂无内容'}</p>
        )}
      </CardContent>
    </Card>
  )
}
