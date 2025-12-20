'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  Plus,
  X,
  ImageIcon,
  CheckCircle,
  ExternalLink,
} from 'lucide-react'
import { publishNoteToXhs } from '@/actions/publish'

interface PublishNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
}

export function PublishNoteDialog({
  open,
  onOpenChange,
  accountId,
}: PublishNoteDialogProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [newImageUrl, setNewImageUrl] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ noteId: string; shareLink: string } | null>(null)

  function handleAddImage() {
    if (!newImageUrl.trim()) return

    // 验证 URL 格式
    try {
      new URL(newImageUrl)
    } catch {
      setError('请输入有效的图片 URL')
      return
    }

    if (imageUrls.length >= 9) {
      setError('最多只能添加 9 张图片')
      return
    }

    setImageUrls([...imageUrls, newImageUrl.trim()])
    setNewImageUrl('')
    setError('')
  }

  function handleRemoveImage(index: number) {
    setImageUrls(imageUrls.filter((_, i) => i !== index))
  }

  async function handlePublish() {
    if (!title.trim()) {
      setError('请输入标题')
      return
    }

    if (imageUrls.length === 0) {
      setError('请至少添加一张图片')
      return
    }

    setPublishing(true)
    setError('')

    try {
      const res = await publishNoteToXhs({
        accountId,
        title: title.trim(),
        content: content.trim(),
        imageUrls,
      })

      if (res.success && res.data) {
        setResult(res.data)
      } else {
        setError(res.error || '发布失败')
      }
    } catch {
      setError('发布失败，请重试')
    } finally {
      setPublishing(false)
    }
  }

  function handleClose() {
    if (!publishing) {
      setTitle('')
      setContent('')
      setImageUrls([])
      setNewImageUrl('')
      setError('')
      setResult(null)
      onOpenChange(false)
    }
  }

  // 发布成功后的展示
  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              发布成功
            </DialogTitle>
            <DialogDescription>笔记已成功发布到小红书</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm text-muted-foreground">笔记 ID</p>
              <p className="font-mono text-sm">{result.noteId}</p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(result.shareLink, '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              查看笔记
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>发布笔记</DialogTitle>
          <DialogDescription>
            填写笔记内容并发布到小红书
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 标题 */}
          <div className="space-y-2">
            <Label htmlFor="title">标题 *</Label>
            <Input
              id="title"
              placeholder="输入笔记标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={20}
              disabled={publishing}
            />
            <p className="text-xs text-muted-foreground text-right">
              {title.length}/20
            </p>
          </div>

          {/* 正文 */}
          <div className="space-y-2">
            <Label htmlFor="content">正文</Label>
            <Textarea
              id="content"
              placeholder="输入笔记正文内容，可使用 #话题[话题]# 格式添加话题"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              disabled={publishing}
            />
            <p className="text-xs text-muted-foreground text-right">
              {content.length} 字
            </p>
          </div>

          {/* 图片列表 */}
          <div className="space-y-2">
            <Label>图片 * (最多 9 张)</Label>

            {/* 已添加的图片 */}
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {imageUrls.map((url, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
                  >
                    <Image
                      src={url}
                      alt={`图片 ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      disabled={publishing}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 添加图片 */}
            {imageUrls.length < 9 && (
              <div className="flex gap-2">
                <Input
                  placeholder="输入图片 URL"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  disabled={publishing}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddImage()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddImage}
                  disabled={publishing || !newImageUrl.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}

            {imageUrls.length === 0 && (
              <div className="flex items-center justify-center p-8 border-2 border-dashed rounded-lg">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">请添加图片 URL</p>
                </div>
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={publishing}>
            取消
          </Button>
          <Button onClick={handlePublish} disabled={publishing}>
            {publishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                发布中...
              </>
            ) : (
              '发布'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
