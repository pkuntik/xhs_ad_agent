'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Heart,
  BookOpen,
} from 'lucide-react'
import type { SyncLogEntry } from '@/types/note'

interface SyncLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  logs: SyncLogEntry[]
  noteTitle?: string
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
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

function getChangeIndicator(before: number | undefined, after: number) {
  if (before === undefined) return null
  const diff = after - before
  if (diff > 0) {
    return (
      <span className="text-green-600 text-xs flex items-center gap-0.5">
        <TrendingUp className="h-3 w-3" />
        +{formatNumber(diff)}
      </span>
    )
  }
  if (diff < 0) {
    return (
      <span className="text-red-600 text-xs flex items-center gap-0.5">
        <TrendingDown className="h-3 w-3" />
        {formatNumber(diff)}
      </span>
    )
  }
  return (
    <span className="text-gray-400 text-xs flex items-center gap-0.5">
      <Minus className="h-3 w-3" />
      0
    </span>
  )
}

export function SyncLogDialog({ open, onOpenChange, logs, noteTitle }: SyncLogDialogProps) {
  // 按时间倒序排列
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime()
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            同步日志
          </DialogTitle>
          {noteTitle && (
            <p className="text-sm text-muted-foreground truncate">{noteTitle}</p>
          )}
        </DialogHeader>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            暂无同步记录
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto pr-2">
            <div className="space-y-3">
              {sortedLogs.map((log, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    log.success
                      ? 'bg-green-50/50 border-green-200'
                      : 'bg-red-50/50 border-red-200'
                  }`}
                >
                  {/* 头部：状态和时间 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {log.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <Badge variant={log.success ? 'default' : 'destructive'} className="text-xs">
                        {log.success ? '成功' : '失败'}
                      </Badge>
                      {log.duration && (
                        <span className="text-xs text-muted-foreground">
                          耗时 {formatDuration(log.duration)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.syncedAt).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* 错误信息 */}
                  {log.error && (
                    <p className="text-xs text-red-600 mb-2">{log.error}</p>
                  )}

                  {/* 数据变化 */}
                  {log.success && log.snapshotAfter && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3 text-muted-foreground" />
                        <span>{formatNumber(log.snapshotAfter.impressions)}</span>
                        {getChangeIndicator(log.snapshotBefore?.impressions, log.snapshotAfter.impressions)}
                      </div>
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3 text-muted-foreground" />
                        <span>{formatNumber(log.snapshotAfter.reads)}</span>
                        {getChangeIndicator(log.snapshotBefore?.reads, log.snapshotAfter.reads)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3 text-muted-foreground" />
                        <span>{formatNumber(log.snapshotAfter.likes)}</span>
                        {getChangeIndicator(log.snapshotBefore?.likes, log.snapshotAfter.likes)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          共 {logs.length} 条记录 · 成功 {logs.filter(l => l.success).length} 次 · 失败 {logs.filter(l => !l.success).length} 次
        </div>
      </DialogContent>
    </Dialog>
  )
}
