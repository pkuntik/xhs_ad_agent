'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ExternalLink,
  RefreshCw,
  Eye,
  BookOpen,
  Heart,
  MessageCircle,
  Bookmark,
  TrendingUp,
  TrendingDown,
  Minus,
  User,
  Loader2,
} from 'lucide-react'
import { syncNoteData } from '@/actions/note'
import type { Publication } from '@/types/work'
import type { NoteSnapshot } from '@/types/note'

interface NoteCardProps {
  publication: Publication
  workId: string
  index: number
  onRefresh?: () => void
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

function getTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
  if (current > previous * 1.01) return 'up'
  if (current < previous * 0.99) return 'down'
  return 'stable'
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-green-500" />
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />
  return <Minus className="h-3 w-3 text-gray-400" />
}

export function NoteCard({ publication, workId, index, onRefresh }: NoteCardProps) {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  const detail = publication.noteDetail
  const snapshots = publication.snapshots || []
  const latestSnapshot = snapshots[snapshots.length - 1]
  const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null

  async function handleSync() {
    setSyncing(true)
    setError('')

    try {
      const result = await syncNoteData(workId, index)
      if (!result.success) {
        setError(result.error || '同步失败')
      } else {
        onRefresh?.()
      }
    } catch {
      setError('同步失败')
    } finally {
      setSyncing(false)
    }
  }

  // 如果没有详情数据，显示简单版本
  if (!detail) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <a
              href={publication.noteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate flex-1"
            >
              <ExternalLink className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{publication.noteUrl}</span>
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="ml-2 flex-shrink-0"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            绑定于 {new Date(publication.publishedAt).toLocaleString('zh-CN')}
          </p>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex gap-3 p-3">
          {/* 封面图 */}
          {detail.coverImage && (
            <div className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted">
              <Image
                src={detail.coverImage}
                alt={detail.title}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* 内容区 */}
          <div className="flex-1 min-w-0">
            {/* 标题 */}
            <a
              href={publication.noteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm hover:text-blue-600 line-clamp-2 flex items-start gap-1"
            >
              <span className="flex-1">{detail.title}</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5" />
            </a>

            {/* 作者信息 */}
            <div className="flex items-center gap-2 mt-1.5">
              {detail.authorAvatar && (
                <Image
                  src={detail.authorAvatar}
                  alt={detail.authorNickname}
                  width={16}
                  height={16}
                  className="w-4 h-4 rounded-full"
                />
              )}
              <span className="text-xs text-muted-foreground">
                {detail.authorNickname}
              </span>
              <Badge variant="outline" className="text-xs h-4 px-1">
                {detail.noteType === '1' ? '图文' : '视频'}
              </Badge>
            </div>

            {/* 发布时间 */}
            <p className="text-xs text-muted-foreground mt-1">
              发布于 {detail.createDate}
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-col items-end justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSync}
              disabled={syncing}
              className="h-8 w-8"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            {publication.lastSyncAt && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(publication.lastSyncAt).toLocaleString('zh-CN', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>

        {/* 数据指标 */}
        {latestSnapshot && (
          <div className="border-t bg-muted/30 px-3 py-2">
            <div className="grid grid-cols-6 gap-2 text-center">
              <StatItem
                icon={<Eye className="h-3 w-3" />}
                label="曝光"
                value={latestSnapshot.impressions}
                previousValue={previousSnapshot?.impressions}
              />
              <StatItem
                icon={<BookOpen className="h-3 w-3" />}
                label="阅读"
                value={latestSnapshot.reads}
                previousValue={previousSnapshot?.reads}
              />
              <StatItem
                icon={<Heart className="h-3 w-3" />}
                label="点赞"
                value={latestSnapshot.likes}
                previousValue={previousSnapshot?.likes}
              />
              <StatItem
                icon={<Bookmark className="h-3 w-3" />}
                label="收藏"
                value={latestSnapshot.collects}
                previousValue={previousSnapshot?.collects}
              />
              <StatItem
                icon={<MessageCircle className="h-3 w-3" />}
                label="评论"
                value={latestSnapshot.comments}
                previousValue={previousSnapshot?.comments}
              />
              <StatItem
                icon={<User className="h-3 w-3" />}
                label="互动"
                value={latestSnapshot.interactions}
                previousValue={previousSnapshot?.interactions}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="border-t px-3 py-2">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatItem({
  icon,
  label,
  value,
  previousValue,
}: {
  icon: React.ReactNode
  label: string
  value: number
  previousValue?: number
}) {
  const trend = previousValue !== undefined ? getTrend(value, previousValue) : 'stable'

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-0.5 text-muted-foreground">
        {icon}
      </div>
      <div className="flex items-center gap-0.5 mt-0.5">
        <span className="text-xs font-medium">{formatNumber(value)}</span>
        {previousValue !== undefined && <TrendIcon trend={trend} />}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}
