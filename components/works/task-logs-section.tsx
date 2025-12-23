'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  ChevronDown,
  ChevronUp,
  Activity,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  PlayCircle,
  Timer,
} from 'lucide-react'
import { getPublicationTaskLogs } from '@/actions/delivery'

interface TaskItem {
  _id: string
  type: string
  status: string
  scheduledAt: string
  startedAt?: string
  completedAt?: string
  result?: Record<string, unknown>
  error?: string
}

interface TaskLogsSectionProps {
  workId: string
  publicationIndex: number
  isExpanded?: boolean
}

const TASK_TYPE_LABELS: Record<string, string> = {
  check_managed_campaign: '效果检查',
  create_campaign: '创建投放',
  pause_campaign: '暂停投放',
  restart_campaign: '重启投放',
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return formatDateTime(dateStr)
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px]">
          <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
          完成
        </Badge>
      )
    case 'running':
      return (
        <Badge className="bg-blue-100 text-blue-700 text-[10px] hover:bg-blue-100">
          <PlayCircle className="h-2.5 w-2.5 mr-0.5 animate-pulse" />
          执行中
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-700 text-[10px]">
          <XCircle className="h-2.5 w-2.5 mr-0.5" />
          失败
        </Badge>
      )
    case 'pending':
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-[10px]">
          <Timer className="h-2.5 w-2.5 mr-0.5" />
          待执行
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">
          {status}
        </Badge>
      )
  }
}

export function TaskLogsSection({
  workId,
  publicationIndex,
  isExpanded: initialExpanded = false,
}: TaskLogsSectionProps) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (expanded && !loaded) {
      loadTasks()
    }
  }, [expanded, loaded])

  async function loadTasks() {
    setLoading(true)
    try {
      const result = await getPublicationTaskLogs(workId, publicationIndex, 15)
      if (result.success && result.tasks) {
        setTasks(result.tasks)
      }
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  // 统计待执行和执行中的任务
  const pendingCount = tasks.filter((t) => t.status === 'pending').length
  const runningCount = tasks.filter((t) => t.status === 'running').length

  return (
    <div className="border-t border-purple-100">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-purple-50/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          运行日志
          {tasks.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {tasks.length}
            </Badge>
          )}
          {runningCount > 0 && (
            <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0 hover:bg-blue-100">
              {runningCount} 执行中
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5 py-0">
              {pendingCount} 待执行
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
          ) : tasks.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground">
              暂无运行日志
            </div>
          ) : (
            <div className="space-y-1.5">
              {tasks.map((task) => (
                <div
                  key={task._id}
                  className={`rounded p-2 text-xs border ${
                    task.status === 'running'
                      ? 'bg-blue-50 border-blue-100'
                      : task.status === 'failed'
                        ? 'bg-red-50 border-red-100'
                        : task.status === 'pending'
                          ? 'bg-yellow-50 border-yellow-100'
                          : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {TASK_TYPE_LABELS[task.type] || task.type}
                      </span>
                      <StatusBadge status={task.status} />
                    </div>
                    <span className="text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(task.completedAt || task.startedAt || task.scheduledAt)}
                    </span>
                  </div>

                  {/* 显示执行结果摘要 */}
                  {task.result && 'decision' in task.result && (
                    <div className="mt-1 text-muted-foreground">
                      决策: <span className="text-foreground">{String(task.result.decision)}</span>
                      {'reason' in task.result && Boolean(task.result.reason) && (
                        <span> - {String(task.result.reason)}</span>
                      )}
                    </div>
                  )}

                  {/* 显示错误信息 */}
                  {task.error && (
                    <div className="mt-1 text-red-600">
                      错误: {task.error}
                    </div>
                  )}

                  {/* 显示计划执行时间（对于待执行任务） */}
                  {task.status === 'pending' && (
                    <div className="mt-1 text-muted-foreground">
                      计划时间: {formatDateTime(task.scheduledAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
