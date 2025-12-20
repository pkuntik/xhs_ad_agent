'use client'

import { useState, useEffect } from 'react'
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
import {
  Loader2,
  CheckCircle,
  ExternalLink,
  ImageIcon,
  Check,
} from 'lucide-react'
import { publishFromWork } from '@/actions/publish'
import { getPublishableWorks } from '@/actions/work'
import type { Work } from '@/types/work'

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
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ noteId: string; shareLink: string } | null>(null)

  // 加载可发布的作品列表
  useEffect(() => {
    if (open) {
      loadWorks()
    }
  }, [open])

  async function loadWorks() {
    setLoading(true)
    setError('')
    try {
      const workList = await getPublishableWorks()
      setWorks(workList)
    } catch {
      setError('加载作品列表失败')
    } finally {
      setLoading(false)
    }
  }

  async function handlePublish() {
    if (!selectedWorkId) {
      setError('请选择一个作品')
      return
    }

    setPublishing(true)
    setError('')

    try {
      const res = await publishFromWork({
        accountId,
        workId: selectedWorkId,
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
      setSelectedWorkId(null)
      setError('')
      setResult(null)
      onOpenChange(false)
    }
  }

  // 获取作品的显示信息
  function getWorkDisplay(work: Work) {
    const title = work.draftContent?.title?.text || work.title || '无标题'
    const coverUrl = work.draftContent?.cover?.imageUrl || work.coverUrl
    const imageCount = (work.draftContent?.images?.length || 0) + (coverUrl ? 1 : 0)
    return { title, coverUrl, imageCount }
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
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>发布笔记</DialogTitle>
          <DialogDescription>
            选择一个作品发布到小红书
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : works.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>暂无可发布的作品</p>
              <p className="text-sm mt-1">请先创建作品</p>
            </div>
          ) : (
            <div className="h-[400px] overflow-y-auto pr-4">
              <div className="space-y-2">
                {works.map((work) => {
                  const { title, coverUrl, imageCount } = getWorkDisplay(work)
                  const isSelected = selectedWorkId === work._id?.toString()

                  return (
                    <button
                      key={work._id?.toString()}
                      type="button"
                      onClick={() => setSelectedWorkId(work._id?.toString() || null)}
                      disabled={publishing}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      {/* 封面 */}
                      <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                        {coverUrl ? (
                          <Image
                            src={coverUrl}
                            alt={title}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-clamp-2">{title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {imageCount} 张图片
                        </p>
                      </div>

                      {/* 选中标记 */}
                      {isSelected && (
                        <div className="flex-shrink-0">
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={publishing}>
            取消
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishing || !selectedWorkId}
          >
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
