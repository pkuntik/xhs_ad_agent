'use client'

import { useEffect, useRef, useCallback } from 'react'

interface UsePollingOptions {
  interval?: number      // 轮询间隔（毫秒），默认 5 分钟
  enabled?: boolean      // 是否启用
  onError?: (error: Error) => void
}

/**
 * 轮询 Hook - 定时执行任务检查
 *
 * 用于替代 Vercel Cron（Hobby 账户限制）
 * 当用户打开管理后台时，自动轮询执行待处理任务
 */
export function useTaskPolling(options: UsePollingOptions = {}) {
  const {
    interval = 5 * 60 * 1000, // 默认 5 分钟
    enabled = true,
    onError,
  } = options

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isRunningRef = useRef(false)

  const executeTasks = useCallback(async () => {
    if (isRunningRef.current) return

    isRunningRef.current = true
    try {
      const response = await fetch('/api/poll-tasks', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log('[Polling] 任务执行结果:', result)
    } catch (error) {
      console.error('[Polling] 任务执行失败:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    } finally {
      isRunningRef.current = false
    }
  }, [onError])

  useEffect(() => {
    if (!enabled) return

    // 页面加载后立即执行一次
    const initialDelay = setTimeout(() => {
      executeTasks()
    }, 5000) // 5秒后首次执行

    // 设置定时轮询
    timerRef.current = setInterval(executeTasks, interval)

    return () => {
      clearTimeout(initialDelay)
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [enabled, interval, executeTasks])

  return { executeTasks }
}
