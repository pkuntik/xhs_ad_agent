'use client'

import { useTaskPolling } from '@/hooks/use-task-polling'

/**
 * 任务轮询提供者
 *
 * 在 Dashboard 布局中使用，当用户打开后台时自动轮询执行任务
 */
export function TaskPollingProvider({ children }: { children: React.ReactNode }) {
  useTaskPolling({
    interval: 5 * 60 * 1000, // 5 分钟
    enabled: true,
    onError: (error) => {
      console.error('任务轮询出错:', error)
    },
  })

  return <>{children}</>
}
