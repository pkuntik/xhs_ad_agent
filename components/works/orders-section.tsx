'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  PauseCircle,
  PlayCircle,
  AlertCircle,
} from 'lucide-react'
import { getPublicationOrders } from '@/actions/delivery'

interface OrderItem {
  _id: string
  orderNo: string
  status: string
  budget: number
  spent: number
  impressions: number
  leads: number
  createdAt: string
  startedAt?: string
  endedAt?: string
}

interface OrdersSectionProps {
  workId: string
  publicationIndex: number
  isExpanded?: boolean
}

const PAGE_SIZE = 5

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <PlayCircle className="h-3 w-3 mr-1" />
          投放中
        </Badge>
      )
    case 'paused':
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
          <PauseCircle className="h-3 w-3 mr-1" />
          已暂停
        </Badge>
      )
    case 'completed':
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          <CheckCircle className="h-3 w-3 mr-1" />
          已完成
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-700">
          <XCircle className="h-3 w-3 mr-1" />
          已失败
        </Badge>
      )
    case 'pending':
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-700">
          <AlertCircle className="h-3 w-3 mr-1" />
          待执行
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary">
          {status}
        </Badge>
      )
  }
}

export function OrdersSection({
  workId,
  publicationIndex,
  isExpanded: initialExpanded = false,
}: OrdersSectionProps) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const [allOrders, setAllOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (expanded && !loaded) {
      loadOrders()
    }
  }, [expanded, loaded])

  async function loadOrders() {
    setLoading(true)
    try {
      const result = await getPublicationOrders(workId, publicationIndex)
      if (result.success && result.orders) {
        setAllOrders(result.orders)
      }
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  // 分页计算
  const totalPages = Math.ceil(allOrders.length / PAGE_SIZE)
  const startIdx = (page - 1) * PAGE_SIZE
  const orders = allOrders.slice(startIdx, startIdx + PAGE_SIZE)

  // 统计活跃订单数
  const activeCount = allOrders.filter((o) => o.status === 'active').length

  return (
    <div className="border-t border-purple-100">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-purple-50/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <ShoppingCart className="h-3.5 w-3.5" />
          投放订单
          {allOrders.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {allOrders.length}
            </Badge>
          )}
          {activeCount > 0 && (
            <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0 hover:bg-green-100">
              {activeCount} 进行中
            </Badge>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground">加载中...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground">
              暂无投放订单
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {orders.map((order) => (
                  <div
                    key={order._id}
                    className={`rounded-lg p-2.5 text-xs border ${
                      order.status === 'active'
                        ? 'bg-green-50 border-green-100'
                        : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">
                          {order.orderNo.slice(-8)}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <span className="text-muted-foreground">
                        {formatDateTime(order.createdAt)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-muted-foreground">预算</span>
                        <p className="font-medium">¥{order.budget}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">消耗</span>
                        <p className="font-medium">¥{order.spent}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">时间</span>
                        <p className="font-medium flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {order.startedAt
                            ? formatDateTime(order.startedAt).split(' ')[1]
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 分页控制 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t">
                  <span className="text-[10px] text-muted-foreground">
                    第 {page}/{totalPages} 页，共 {allOrders.length} 条
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
