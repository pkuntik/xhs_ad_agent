'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Loader2,
  RefreshCw,
  Eye,
  Heart,
  MessageCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  ImageIcon,
  Users,
} from 'lucide-react'
import { syncOrders, getSyncedOrders } from '@/actions/account'
import type { OrderListItem } from '@/types/order'

interface OrdersListProps {
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

function formatDate(date: string): string {
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMoney(amount: number): string {
  return '¥' + amount.toFixed(2)
}

// 订单状态样式
function getStateBadge(state: number, stateDesc: string) {
  switch (state) {
    case 1:
      return <Badge className="bg-green-500 hover:bg-green-500">投放中</Badge>
    case 2:
      return <Badge variant="secondary">已结束</Badge>
    case 3:
      return <Badge className="bg-yellow-500 hover:bg-yellow-500">审核中</Badge>
    case 4:
      return <Badge variant="outline">已退款</Badge>
    case 5:
      return <Badge variant="secondary">已暂停</Badge>
    default:
      return <Badge variant="secondary">{stateDesc}</Badge>
  }
}

// 效果数据指标组件
function MetricsTooltip({ order }: { order: OrderListItem }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 text-xs text-muted-foreground cursor-help">
            <span className="flex items-center gap-0.5">
              <Eye className="h-3 w-3" />
              {formatNumber(order.impression)}
            </span>
            <span className="flex items-center gap-0.5">
              <Heart className="h-3 w-3" />
              {formatNumber(order.likes)}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" />
              {formatNumber(order.comments)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="p-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>展现 {formatNumber(order.impression)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 text-center">📖</span>
              <span>阅读 {formatNumber(order.read)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              <span>点赞 {formatNumber(order.likes)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Bookmark className="h-3 w-3" />
              <span>收藏 {formatNumber(order.favorite)}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              <span>评论 {formatNumber(order.comments)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>关注 {formatNumber(order.follow)}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// 笔记缩略图组件
function NotesThumbnail({ notes }: { notes?: OrderListItem['notes'] }) {
  if (!notes || notes.length === 0) {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  if (notes.length === 1) {
    const note = notes[0]
    return (
      <div className="flex items-center gap-2">
        <div className="relative w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
          {note.note_image ? (
            <Image
              src={note.note_image}
              alt={note.note_title || ''}
              fill
              className="object-cover"
              sizes="32px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </div>
        <span className="text-xs truncate max-w-[100px]" title={note.note_title}>
          {note.note_title || '无标题'}
        </span>
      </div>
    )
  }

  // 多个笔记时显示缩略图堆叠
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            <div className="flex -space-x-2">
              {notes.slice(0, 3).map((note, index) => (
                <div
                  key={index}
                  className="relative w-7 h-7 rounded overflow-hidden bg-muted border-2 border-background"
                  style={{ zIndex: 3 - index }}
                >
                  {note.note_image ? (
                    <Image
                      src={note.note_image}
                      alt={note.note_title || ''}
                      fill
                      className="object-cover"
                      sizes="28px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{notes.length}篇</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="p-2">
          <div className="space-y-1">
            {notes.map((note, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded overflow-hidden bg-muted flex-shrink-0">
                  {note.note_image ? (
                    <Image
                      src={note.note_image}
                      alt={note.note_title || ''}
                      fill
                      className="object-cover"
                      sizes="24px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-2 w-2 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <span className="text-xs truncate max-w-[150px]">{note.note_title || '无标题'}</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function OrdersList({ accountId }: OrdersListProps) {
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [syncResult, setSyncResult] = useState<{ synced: number; updated: number } | null>(null)

  const pageSize = 10
  const totalPages = Math.ceil(total / pageSize)

  const loadOrders = useCallback(async (pageNum: number = 1) => {
    setLoading(true)
    setError('')

    try {
      const result = await getSyncedOrders(accountId, {
        page: pageNum,
        pageSize,
      })

      if (result.success && result.data) {
        setOrders(result.data.list)
        setTotal(result.data.total)
        setPage(pageNum)
      } else {
        setError(result.error || '获取订单列表失败')
      }
    } catch {
      setError('获取订单列表失败')
    } finally {
      setLoading(false)
    }
  }, [accountId])

  // 初始加载
  useEffect(() => {
    loadOrders(1)
  }, [loadOrders])

  async function handleSync() {
    setSyncing(true)
    setError('')
    setSyncResult(null)

    try {
      const result = await syncOrders(accountId)

      if (result.success && result.data) {
        setSyncResult({
          synced: result.data.synced,
          updated: result.data.updated,
        })
        // 同步成功后重新加载列表
        await loadOrders(1)
      } else {
        setError(result.error || '同步失败')
      }
    } catch {
      setError('同步订单失败')
    } finally {
      setSyncing(false)
    }
  }

  function handlePrevPage() {
    if (page > 1) {
      loadOrders(page - 1)
    }
  }

  function handleNextPage() {
    if (page < totalPages) {
      loadOrders(page + 1)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">薯条订单</CardTitle>
          {total > 0 && <Badge variant="secondary">{total} 个</Badge>}
        </div>
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
          同步订单
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {/* 同步结果提示 */}
        {syncResult && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            同步完成：新增 {syncResult.synced} 个，更新 {syncResult.updated} 个
          </div>
        )}

        {error && (
          <div className="text-center text-red-500 py-4">{error}</div>
        )}

        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 && !error ? (
          <p className="text-center text-muted-foreground py-8">
            暂无订单，点击"同步订单"获取薯条投放订单
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[80px]">状态</TableHead>
                  <TableHead className="w-[140px]">笔记</TableHead>
                  <TableHead className="w-[100px]">推广目标</TableHead>
                  <TableHead className="text-right w-[80px]">预算</TableHead>
                  <TableHead className="text-right w-[80px]">消耗</TableHead>
                  <TableHead className="text-right w-[80px]">CPA</TableHead>
                  <TableHead className="w-[150px]">效果数据</TableHead>
                  <TableHead className="w-[100px]">创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order._id} className="hover:bg-muted/30">
                    <TableCell>
                      {getStateBadge(order.state, order.stateDesc)}
                    </TableCell>
                    <TableCell>
                      <NotesThumbnail notes={order.notes} />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{order.advertiseTargetDesc}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(order.campaignBudget)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={order.consume > 0 ? 'text-orange-600 font-medium' : ''}>
                        {formatMoney(order.consume)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={order.cpa > 0 ? 'text-blue-600 font-medium' : 'text-muted-foreground'}>
                        {order.cpa > 0 ? formatMoney(order.cpa) : '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {order.impression > 0 || order.read > 0 ? (
                        <MetricsTooltip order={order} />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(order.createTime)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              第 {page} / {totalPages} 页，共 {total} 条
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
