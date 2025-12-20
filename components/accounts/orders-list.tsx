'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
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
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  ImageIcon,
  Users,
  Home,
  TrendingUp,
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
  return amount.toFixed(2)
}

// 订单状态样式
function getStateBadge(state: number, stateDesc: string) {
  switch (state) {
    case 1:
      return <Badge variant="default" className="text-xs">投放中</Badge>
    case 2:
      return <Badge variant="destructive" className="text-xs">已结束</Badge>
    case 3:
      return <Badge variant="secondary" className="text-xs">审核中</Badge>
    case 4:
      return <Badge variant="outline" className="text-xs">已退款</Badge>
    case 5:
      return <Badge variant="secondary" className="text-xs">已暂停</Badge>
    default:
      return <Badge variant="secondary" className="text-xs">{stateDesc}</Badge>
  }
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
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">投放订单</CardTitle>
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
      <CardContent>
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
            暂无订单，点击"同步订单"获取该账号的投放订单
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order._id}
                className="p-4 rounded-lg bg-muted/50 space-y-3"
              >
                {/* 头部：状态和时间 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStateBadge(order.state, order.stateDesc)}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(order.createTime)}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {order.advertiseTargetDesc}
                  </Badge>
                </div>

                {/* 笔记信息 */}
                {order.notes && order.notes.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {order.notes.map((note, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 flex-shrink-0 p-2 bg-background rounded-md"
                      >
                        <div className="relative w-10 h-10 rounded overflow-hidden bg-muted">
                          {note.note_image ? (
                            <Image
                              src={note.note_image}
                              alt={note.note_title}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="max-w-[120px]">
                          <p className="text-xs font-medium line-clamp-1">
                            {note.note_title || '无标题'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {note.author_name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 预算与消耗 */}
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-lg font-semibold">{formatMoney(order.campaignBudget)}</p>
                    <p className="text-xs text-muted-foreground">预算(元)</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-orange-600">{formatMoney(order.consume)}</p>
                    <p className="text-xs text-muted-foreground">消耗(元)</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-green-600">{formatMoney(order.actualRefund)}</p>
                    <p className="text-xs text-muted-foreground">退款(元)</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-blue-600">{formatMoney(order.cpa)}</p>
                    <p className="text-xs text-muted-foreground">CPA(元)</p>
                  </div>
                </div>

                {/* 效果数据 */}
                {(order.impression > 0 || order.read > 0) && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {formatNumber(order.impression)} 展现
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {formatNumber(order.read)} 阅读
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {formatNumber(order.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bookmark className="h-3 w-3" />
                      {formatNumber(order.favorite)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {formatNumber(order.comments)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {formatNumber(order.follow)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Home className="h-3 w-3" />
                      {formatNumber(order.homepageView)}
                    </span>
                  </div>
                )}

                {/* 状态描述 */}
                {order.stateDesc && order.state !== 1 && (
                  <p className="text-xs text-muted-foreground line-clamp-2 pt-2 border-t">
                    {order.stateDesc}
                  </p>
                )}
              </div>
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
