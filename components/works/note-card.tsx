'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
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
  Loader2,
  Trash2,
  History,
  Image as ImageIcon,
  Play,
  Clock,
  Zap,
  Settings,
  UserPlus,
  Rocket,
  PauseCircle,
  StopCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { syncNoteData, deletePublication } from '@/actions/note'
import { markFollowerAdded } from '@/actions/delivery'
import { SyncLogDialog } from '@/components/works/sync-log-dialog'
import { DeliveryConfigDialog } from '@/components/works/delivery-config-dialog'
import { DeliveryStopDialog } from '@/components/works/delivery-stop-dialog'
import type { Publication } from '@/types/work'

interface NoteCardProps {
  publication: Publication
  workId: string
  index: number
  onRefresh?: () => void
  onDelete?: () => void
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

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  return new Date(date).toLocaleDateString('zh-CN')
}

export function NoteCard({ publication, workId, index, onRefresh, onDelete }: NoteCardProps) {
  const [syncing, setSyncing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showLogDialog, setShowLogDialog] = useState(false)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [showStopDialog, setShowStopDialog] = useState(false)
  const [markingFollower, setMarkingFollower] = useState(false)
  const [error, setError] = useState('')

  const detail = publication.noteDetail
  const snapshots = publication.snapshots || []
  const syncLogs = publication.syncLogs || []
  const latestSnapshot = snapshots[snapshots.length - 1]
  const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null

  // 托管投放状态
  const deliveryConfig = publication.deliveryConfig
  const deliveryStats = publication.deliveryStats
  const deliveryStatus = publication.deliveryStatus || 'idle'
  const isDeliveryEnabled = deliveryConfig?.enabled || false
  const isDeliveryRunning = deliveryStatus === 'running'

  async function handleSync() {
    setSyncing(true)
    setError('')

    try {
      const result = await syncNoteData(workId, index)
      if (!result.success) {
        setError(result.error || '同步失败')
        toast.error(result.error || '同步失败')
      } else {
        toast.success('数据已同步')
        onRefresh?.()
      }
    } catch {
      setError('同步失败')
      toast.error('同步失败')
    } finally {
      setSyncing(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)

    try {
      const result = await deletePublication(workId, index)
      if (result.success) {
        toast.success('已删除绑定的笔记')
        setShowDeleteDialog(false)
        onDelete?.()
      } else {
        toast.error(result.error || '删除失败')
      }
    } catch {
      toast.error('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  async function handleMarkFollower() {
    setMarkingFollower(true)

    try {
      const result = await markFollowerAdded(workId, index)
      if (result.success) {
        toast.success('已标记加粉成功')
        onRefresh?.()
      } else {
        toast.error(result.error || '标记失败')
      }
    } catch {
      toast.error('标记失败')
    } finally {
      setMarkingFollower(false)
    }
  }

  // 托管投放开关处理
  function handleDeliveryToggle() {
    if (isDeliveryRunning) {
      // 正在运行，显示停止确认对话框
      setShowStopDialog(true)
    } else {
      // 未运行，显示配置对话框
      setShowConfigDialog(true)
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
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogDialog(true)}
                title="同步日志"
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                title="同步数据"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                title="删除"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            绑定于 {new Date(publication.publishedAt).toLocaleString('zh-CN')}
          </p>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </CardContent>

        {/* 删除确认对话框 */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
              <DialogDescription>
                确定要删除这个绑定的笔记吗？此操作不可恢复。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                取消
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 同步日志对话框 */}
        <SyncLogDialog
          open={showLogDialog}
          onOpenChange={setShowLogDialog}
          logs={syncLogs}
        />
      </Card>
    )
  }

  const isVideo = detail.noteType === '2'
  const imagesCount = detail.images?.length || 0

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        {/* 主内容区 */}
        <div className="flex gap-4 p-4">
          {/* 封面图 - 更大尺寸 */}
          <div className="relative w-28 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
            {detail.coverImage ? (
              <Image
                src={detail.coverImage}
                alt={detail.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            {/* 类型标识 */}
            <div className="absolute top-1.5 left-1.5">
              {isVideo ? (
                <div className="bg-black/60 rounded-full p-1">
                  <Play className="h-3 w-3 text-white fill-white" />
                </div>
              ) : imagesCount > 1 ? (
                <div className="bg-black/60 rounded px-1.5 py-0.5 text-[10px] text-white font-medium">
                  {imagesCount}图
                </div>
              ) : null}
            </div>
          </div>

          {/* 内容区 */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* 标题 */}
            <a
              href={publication.noteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm hover:text-blue-600 line-clamp-2 leading-snug group"
            >
              {detail.title}
              <ExternalLink className="inline-block h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>

            {/* 内容预览 */}
            {detail.content && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                {detail.content.slice(0, 100)}
              </p>
            )}

            {/* 作者和时间 */}
            <div className="flex items-center gap-2 mt-auto pt-2">
              {detail.authorAvatar && (
                <Image
                  src={detail.authorAvatar}
                  alt={detail.authorNickname}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              )}
              <span className="text-xs text-muted-foreground font-medium">
                {detail.authorNickname}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {detail.createDate}
              </span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-col items-end justify-between">
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLogDialog(true)}
                className="h-8 w-8"
                title="同步日志"
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSync}
                disabled={syncing}
                className="h-8 w-8"
                title="同步数据"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                title="删除"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {publication.lastSyncAt && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatTimeAgo(publication.lastSyncAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 数据指标 - 更详细的展示 */}
        {latestSnapshot && (
          <div className="border-t bg-gradient-to-r from-muted/30 to-muted/50 px-4 py-3">
            <div className="grid grid-cols-6 gap-3">
              <StatItem
                icon={<Eye className="h-4 w-4" />}
                label="曝光"
                value={latestSnapshot.impressions}
                previousValue={previousSnapshot?.impressions}
                color="text-blue-600"
              />
              <StatItem
                icon={<BookOpen className="h-4 w-4" />}
                label="阅读"
                value={latestSnapshot.reads}
                previousValue={previousSnapshot?.reads}
                color="text-cyan-600"
              />
              <StatItem
                icon={<Heart className="h-4 w-4" />}
                label="点赞"
                value={latestSnapshot.likes}
                previousValue={previousSnapshot?.likes}
                color="text-pink-600"
              />
              <StatItem
                icon={<Bookmark className="h-4 w-4" />}
                label="收藏"
                value={latestSnapshot.collects}
                previousValue={previousSnapshot?.collects}
                color="text-yellow-600"
              />
              <StatItem
                icon={<MessageCircle className="h-4 w-4" />}
                label="评论"
                value={latestSnapshot.comments}
                previousValue={previousSnapshot?.comments}
                color="text-green-600"
              />
              <StatItem
                icon={<Zap className="h-4 w-4" />}
                label="互动"
                value={latestSnapshot.interactions}
                previousValue={previousSnapshot?.interactions}
                color="text-orange-600"
              />
            </div>

            {/* 互动率 */}
            {latestSnapshot.impressions > 0 && (
              <div className="mt-2 pt-2 border-t border-muted/50 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">阅读率:</span>
                  <span className="font-medium text-cyan-600">
                    {((latestSnapshot.reads / latestSnapshot.impressions) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">互动率:</span>
                  <span className="font-medium text-orange-600">
                    {((latestSnapshot.interactions / latestSnapshot.impressions) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">收藏率:</span>
                  <span className="font-medium text-yellow-600">
                    {((latestSnapshot.collects / latestSnapshot.reads) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 托管投放区域 */}
        <div className="border-t bg-gradient-to-r from-purple-50/50 to-blue-50/50 px-4 py-3">
          <div className="flex items-center justify-between">
            {/* 左侧：状态和开关 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isDeliveryRunning}
                  onCheckedChange={handleDeliveryToggle}
                  className="data-[state=checked]:bg-purple-600"
                />
                <span className="text-sm font-medium">托管投放</span>
              </div>
              {/* 状态徽章 */}
              {deliveryStatus === 'running' && (
                <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                  <Rocket className="h-3 w-3 mr-1" />
                  投放中
                </Badge>
              )}
              {deliveryStatus === 'paused' && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                  <PauseCircle className="h-3 w-3 mr-1" />
                  已暂停
                </Badge>
              )}
              {deliveryStatus === 'stopped' && (
                <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                  <StopCircle className="h-3 w-3 mr-1" />
                  已停止
                </Badge>
              )}
            </div>

            {/* 右侧：操作按钮 */}
            <div className="flex items-center gap-2">
              {isDeliveryRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkFollower}
                  disabled={markingFollower}
                  className="text-green-600 border-green-200 hover:bg-green-50"
                >
                  {markingFollower ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <UserPlus className="h-3 w-3 mr-1" />
                  )}
                  标记加粉
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfigDialog(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 投放统计 */}
          {deliveryStats && deliveryStats.totalAttempts > 0 && (
            <div className="mt-2 pt-2 border-t border-purple-100 grid grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">投放次数</span>
                <p className="font-medium">{deliveryStats.totalAttempts} 次</p>
              </div>
              <div>
                <span className="text-muted-foreground">成功次数</span>
                <p className="font-medium text-green-600">{deliveryStats.successfulAttempts} 次</p>
              </div>
              <div>
                <span className="text-muted-foreground">平均消耗</span>
                <p className="font-medium">{deliveryStats.avgSpentPerAttempt.toFixed(0)} 元</p>
              </div>
              <div>
                <span className="text-muted-foreground">起量概率</span>
                <p className="font-medium text-purple-600">{deliveryStats.successRate.toFixed(1)}%</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="border-t px-4 py-2 bg-red-50">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}
      </CardContent>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除绑定的笔记「{detail.title}」吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 同步日志对话框 */}
      <SyncLogDialog
        open={showLogDialog}
        onOpenChange={setShowLogDialog}
        logs={syncLogs}
        noteTitle={detail.title}
      />

      {/* 托管配置对话框 */}
      <DeliveryConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        workId={workId}
        publicationIndex={index}
        currentConfig={deliveryConfig}
        noteTitle={detail.title}
        onSaved={onRefresh}
      />

      {/* 停止托管对话框 */}
      <DeliveryStopDialog
        open={showStopDialog}
        onOpenChange={setShowStopDialog}
        workId={workId}
        publicationIndex={index}
        noteTitle={detail.title}
        onStopped={onRefresh}
      />
    </Card>
  )
}

function StatItem({
  icon,
  label,
  value,
  previousValue,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  previousValue?: number
  color?: string
}) {
  const trend = previousValue !== undefined ? getTrend(value, previousValue) : 'stable'
  const diff = previousValue !== undefined ? value - previousValue : 0

  return (
    <div className="flex flex-col items-center">
      <div className={`${color || 'text-muted-foreground'}`}>
        {icon}
      </div>
      <div className="flex items-center gap-0.5 mt-1">
        <span className="text-sm font-semibold">{formatNumber(value)}</span>
      </div>
      <div className="flex items-center gap-0.5">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        {previousValue !== undefined && diff !== 0 && (
          <span className={`text-[10px] ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
            {trend === 'up' ? '+' : ''}{formatNumber(diff)}
          </span>
        )}
      </div>
    </div>
  )
}
