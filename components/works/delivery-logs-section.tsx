'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  Eye,
  MousePointerClick,
  MessageCircle,
  UserPlus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { getPublicationDeliveryLogs } from '@/actions/delivery'
import type { DeliveryDecision } from '@/types/delivery-log'

interface DeliveryLog {
  _id: string
  periodStart: string
  periodEnd: string
  spent: number
  impressions: number
  clicks: number
  leads: number
  followers?: number
  hasFollower?: boolean
  checkStage?: number
  isEffective: boolean
  decision: DeliveryDecision
  decisionReason: string
  createdAt: string
}

interface DeliveryLogsSectionProps {
  workId: string
  publicationIndex: number
  isExpanded?: boolean
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DecisionBadge({ decision }: { decision: DeliveryDecision }) {
  switch (decision) {
    case 'continue':
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700">
          <CheckCircle className="h-3 w-3 mr-1" />
          继续
        </Badge>
      )
    case 'pause':
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
          <AlertCircle className="h-3 w-3 mr-1" />
          暂停
        </Badge>
      )
    case 'restart':
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          <Zap className="h-3 w-3 mr-1" />
          重投
        </Badge>
      )
    case 'switch_work':
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-700">
          <XCircle className="h-3 w-3 mr-1" />
          换作品
        </Badge>
      )
  }
}

function StageBadge({ stage }: { stage?: number }) {
  if (!stage) return null
  return (
    <Badge variant="outline" className="text-xs">
      阶段{stage}
    </Badge>
  )
}

export function DeliveryLogsSection({
  workId,
  publicationIndex,
  isExpanded: initialExpanded = false,
}: DeliveryLogsSectionProps) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const [logs, setLogs] = useState<DeliveryLog[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (expanded && !loaded) {
      loadLogs()
    }
  }, [expanded, loaded])

  async function loadLogs() {
    setLoading(true)
    try {
      const result = await getPublicationDeliveryLogs(workId, publicationIndex, 10)
      if (result.success && result.logs) {
        setLogs(result.logs)
      }
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-purple-100">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-purple-50/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          投放日志
          {logs.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {logs.length}
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
          ) : logs.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground">
              暂无投放日志
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log._id}
                  className={`rounded-lg p-2.5 text-xs ${
                    log.isEffective
                      ? 'bg-green-50 border border-green-100'
                      : 'bg-gray-50 border border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <StageBadge stage={log.checkStage} />
                      <DecisionBadge decision={log.decision} />
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div>
                      <div className="flex items-center justify-center gap-0.5 text-muted-foreground">
                        <Zap className="h-3 w-3" />
                        消耗
                      </div>
                      <div className="font-medium">¥{log.spent.toFixed(0)}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-0.5 text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        展现
                      </div>
                      <div className="font-medium">{log.impressions}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-0.5 text-muted-foreground">
                        <MousePointerClick className="h-3 w-3" />
                        点击
                      </div>
                      <div className="font-medium">{log.clicks}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-0.5 text-muted-foreground">
                        <MessageCircle className="h-3 w-3" />
                        咨询
                      </div>
                      <div className="font-medium">{log.leads}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-0.5 text-muted-foreground">
                        <UserPlus className="h-3 w-3" />
                        加粉
                      </div>
                      <div className={`font-medium ${log.hasFollower ? 'text-green-600' : ''}`}>
                        {log.hasFollower ? '✓' : '-'}
                      </div>
                    </div>
                  </div>

                  {log.decisionReason && (
                    <div className="mt-1.5 pt-1.5 border-t border-gray-200 text-muted-foreground">
                      {log.decisionReason}
                    </div>
                  )}
                </div>
              ))}

              {logs.length >= 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    // 可以扩展为加载更多
                  }}
                >
                  查看更多日志
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
