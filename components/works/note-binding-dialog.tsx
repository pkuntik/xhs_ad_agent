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
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  UserPlus,
  Eye,
  BookOpen,
  Heart,
  MessageCircle,
  Bookmark,
} from 'lucide-react'
import { createLinkedAuthor } from '@/actions/note'
import type { NoteDetail, CachedNoteDetail, NoteSnapshot } from '@/types/note'

interface NoteBindingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  noteUrl: string
  noteId: string
  noteDetail: NoteDetail
  cachedDetail: CachedNoteDetail
  snapshot: NoteSnapshot
  existingAccount?: {
    _id: string
    name: string
    visitorUserId: string
    status: string
  }
  onConfirm: (options: {
    noteId: string
    noteUrl: string
    noteDetail: CachedNoteDetail
    snapshot: NoteSnapshot
    accountId?: string
  }) => void
  onCancel: () => void
}

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

export function NoteBindingDialog({
  open,
  onOpenChange,
  noteUrl,
  noteId,
  noteDetail,
  cachedDetail,
  snapshot,
  existingAccount,
  onConfirm,
  onCancel,
}: NoteBindingDialogProps) {
  const [addingAuthor, setAddingAuthor] = useState(false)
  const [authorAdded, setAuthorAdded] = useState(false)
  const [error, setError] = useState('')

  const baseInfo = noteDetail.baseInfo
  const isActiveAccount = existingAccount?.status === 'active'
  const isPendingAccount = existingAccount?.status === 'pending'

  // 获取笔记标题
  const noteTitle = baseInfo?.title || ''

  async function handleAddAuthor() {
    if (!baseInfo?.author) return

    setAddingAuthor(true)
    setError('')

    try {
      const result = await createLinkedAuthor({
        userId: baseInfo.author.userId,
        nickname: baseInfo.author.nickname,
        avatar: baseInfo.author.userSImage,
      })

      if (result.success) {
        setAuthorAdded(true)
      } else {
        setError(result.error || '添加失败')
      }
    } catch {
      setError('添加作者失败')
    } finally {
      setAddingAuthor(false)
    }
  }

  function handleConfirm() {
    onConfirm({
      noteId,
      noteUrl,
      noteDetail: cachedDetail,
      snapshot,
      accountId: existingAccount?._id,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>确认绑定笔记</DialogTitle>
          <DialogDescription>
            请确认以下笔记信息是否正确
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 笔记预览 */}
          <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
            {baseInfo?.images?.[0] && (
              <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                <Image
                  src={baseInfo.images[0].link}
                  alt={noteTitle}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm line-clamp-2">{noteTitle || '未知标题'}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {baseInfo?.content?.slice(0, 100) || ''}...
              </p>
            </div>
          </div>

          {/* 作者信息 */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              {baseInfo?.author?.userSImage && (
                <Image
                  src={baseInfo.author.userSImage}
                  alt={baseInfo.author.nickname || ''}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div>
                <p className="text-sm font-medium">{baseInfo?.author?.nickname || '未知作者'}</p>
                <p className="text-xs text-muted-foreground">
                  发布于 {baseInfo?.createDate || '未知时间'}
                </p>
              </div>
            </div>

            {isActiveAccount ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                已有账号
              </Badge>
            ) : isPendingAccount || authorAdded ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                已关联
              </Badge>
            ) : baseInfo?.author ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddAuthor}
                disabled={addingAuthor}
              >
                {addingAuthor ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-1" />
                    关联作者
                  </>
                )}
              </Button>
            ) : null}
          </div>

          {/* 数据统计 */}
          <div className="grid grid-cols-5 gap-2 text-center">
            <div className="p-2 bg-muted/30 rounded">
              <Eye className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium mt-1">{formatNumber(snapshot.impressions)}</p>
              <p className="text-xs text-muted-foreground">曝光</p>
            </div>
            <div className="p-2 bg-muted/30 rounded">
              <BookOpen className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium mt-1">{formatNumber(snapshot.reads)}</p>
              <p className="text-xs text-muted-foreground">阅读</p>
            </div>
            <div className="p-2 bg-muted/30 rounded">
              <Heart className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium mt-1">{formatNumber(snapshot.likes)}</p>
              <p className="text-xs text-muted-foreground">点赞</p>
            </div>
            <div className="p-2 bg-muted/30 rounded">
              <Bookmark className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium mt-1">{formatNumber(snapshot.collects)}</p>
              <p className="text-xs text-muted-foreground">收藏</p>
            </div>
            <div className="p-2 bg-muted/30 rounded">
              <MessageCircle className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium mt-1">{formatNumber(snapshot.comments)}</p>
              <p className="text-xs text-muted-foreground">评论</p>
            </div>
          </div>

          {/* 提示信息 */}
          {baseInfo?.author && !existingAccount && !authorAdded && (
            <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-amber-700">
                请先点击"关联作者"记录作者信息，才能绑定笔记。
              </p>
            </div>
          )}

          {error && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={baseInfo?.author && !existingAccount && !authorAdded}
          >
            确认绑定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
