'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  RefreshCw,
  Eye,
  Heart,
  MessageCircle,
  Bookmark,
  Video,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  ExternalLink,
} from 'lucide-react'
import { syncRemoteNotes, getSyncedNotes } from '@/actions/account'
import type { RemoteNoteItem } from '@/types/remote-note'

interface RemoteNotesListProps {
  accountId: string
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

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RemoteNotesList({ accountId }: RemoteNotesListProps) {
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<RemoteNoteItem[]>([])
  const [total, setTotal] = useState(0)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [syncResult, setSyncResult] = useState<{ synced: number; updated: number } | null>(null)

  const pageSize = 10
  const totalPages = Math.ceil(total / pageSize)

  const loadNotes = useCallback(async (pageNum: number = 1) => {
    setLoading(true)
    setError('')

    try {
      const result = await getSyncedNotes(accountId, {
        page: pageNum,
        pageSize,
      })

      if (result.success && result.data) {
        setNotes(result.data.list)
        setTotal(result.data.total)
        setLastSyncAt(result.data.lastSyncAt ? new Date(result.data.lastSyncAt) : null)
        setPage(pageNum)
      } else {
        setError(result.error || '获取笔记列表失败')
      }
    } catch {
      setError('获取笔记列表失败')
    } finally {
      setLoading(false)
    }
  }, [accountId])

  // 初始加载
  useEffect(() => {
    loadNotes(1)
  }, [loadNotes])

  async function handleSync() {
    setSyncing(true)
    setError('')
    setSyncResult(null)

    try {
      const result = await syncRemoteNotes(accountId)

      if (result.success && result.data) {
        setSyncResult({
          synced: result.data.synced,
          updated: result.data.updated,
        })
        // 同步成功后重新加载列表
        await loadNotes(1)
      } else {
        setError(result.error || '同步失败')
      }
    } catch {
      setError('同步笔记失败')
    } finally {
      setSyncing(false)
    }
  }

  function handlePrevPage() {
    if (page > 1) {
      loadNotes(page - 1)
    }
  }

  function handleNextPage() {
    if (page < totalPages) {
      loadNotes(page + 1)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">平台笔记</CardTitle>
          {total > 0 && <Badge variant="secondary">{total} 篇</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {lastSyncAt && (
            <span className="text-xs text-muted-foreground">
              上次同步: {formatDateTime(lastSyncAt)}
            </span>
          )}
          <Button
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            同步笔记
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 同步结果提示 */}
        {syncResult && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            同步完成：新增 {syncResult.synced} 篇，更新 {syncResult.updated} 篇
          </div>
        )}

        {error && (
          <div className="text-center text-red-500 py-4">{error}</div>
        )}

        {loading && notes.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 && !error ? (
          <p className="text-center text-muted-foreground py-8">
            暂无笔记，点击"同步笔记"获取该账号在小红书平台发布的笔记
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <Link
                key={note._id}
                href={`https://www.xiaohongshu.com/explore/${note.noteId}`}
                target="_blank"
                className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
              >
                {/* 封面 */}
                <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                  {note.coverImage ? (
                    <Image
                      src={note.coverImage}
                      alt={note.title}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  {/* 类型标识 */}
                  <div className="absolute bottom-1 right-1">
                    {note.noteType === 2 ? (
                      <Video className="h-3 w-3 text-white drop-shadow" />
                    ) : null}
                  </div>
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-medium text-sm line-clamp-1">
                      {note.title || '无标题'}
                    </p>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {note.authorName} · {formatDate(note.publishedAt)}
                  </p>

                  {/* 数据统计 */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {formatNumber(note.reads)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {formatNumber(note.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bookmark className="h-3 w-3" />
                      {formatNumber(note.favorites)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {formatNumber(note.comments)}
                    </span>
                  </div>
                </div>

                {/* 推广状态 */}
                <div className="flex-shrink-0 self-center">
                  {note.canHeat ? (
                    <Badge variant="success" className="text-xs">
                      可推广
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {note.cantHeatDesc || '不可推广'}
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              第 {page} / {totalPages} 页
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrevPage}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNextPage}
                disabled={page >= totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
