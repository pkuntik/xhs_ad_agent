/**
 * 后台任务运行器
 * 在服务器启动时创建一个定时循环，持续处理任务
 */

let isRunning = false
let intervalId: NodeJS.Timeout | null = null

// 默认间隔 5 秒
const DEFAULT_INTERVAL = 5 * 1000

export async function startBackgroundRunner(interval = DEFAULT_INTERVAL) {
  if (isRunning) {
    console.log('[BackgroundRunner] 已经在运行中')
    return
  }

  isRunning = true
  console.log(`[BackgroundRunner] 启动后台任务运行器，间隔 ${interval / 1000} 秒`)

  // 立即执行一次
  await runTasks()

  // 设置定时循环
  intervalId = setInterval(async () => {
    await runTasks()
  }, interval)
}

export function stopBackgroundRunner() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  isRunning = false
  console.log('[BackgroundRunner] 已停止')
}

async function runTasks() {
  try {
    // 动态导入避免循环依赖
    const { processPendingTasks } = await import('@/actions/task')
    const { processManagedDeliveries } = await import('@/actions/delivery')

    // 处理任务队列
    const taskResult = await processPendingTasks()
    if (taskResult.processed > 0) {
      console.log(`[BackgroundRunner] 处理了 ${taskResult.processed} 个任务`)
    }

    // 处理托管投放
    const managedResult = await processManagedDeliveries()
    if (managedResult.processed > 0) {
      console.log(`[BackgroundRunner] 处理了 ${managedResult.processed} 个托管投放`)
      for (const r of managedResult.results) {
        if (r.action === 'created') {
          console.log(`  - 创建订单: ${r.orderNo}`)
        } else if (r.action === 'error') {
          console.log(`  - 错误: ${r.error}`)
        }
      }
    }
  } catch (error) {
    console.error('[BackgroundRunner] 执行出错:', error)
  }
}
