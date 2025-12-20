'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Edit2 } from 'lucide-react'

interface ContentCardProps {
  type: 'title' | 'content' | 'topics'
  title: string
  value: string
  placeholder?: string
  isEditing?: boolean
  onChange?: (value: string) => void
  multiline?: boolean
  showTags?: boolean
}

export function ContentCard({
  title,
  value,
  placeholder,
  isEditing: externalEditing,
  onChange,
  multiline = false,
  showTags = false,
}: ContentCardProps) {
  // 内部编辑状态（如果没有外部控制）
  const [internalEditing, setInternalEditing] = useState(false)
  const isEditing = externalEditing !== undefined ? externalEditing : internalEditing
  const hasInternalEditControl = externalEditing === undefined

  // 编辑状态
  const [editedValue, setEditedValue] = useState(value)

  // 开始编辑
  function startEditing() {
    setEditedValue(value)
    setInternalEditing(true)
  }

  // 保存编辑
  function saveEditing() {
    if (onChange) {
      onChange(editedValue)
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

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
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
            <Input
              value={editedValue}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={placeholder}
            />
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
