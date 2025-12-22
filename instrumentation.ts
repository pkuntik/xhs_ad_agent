/**
 * Next.js Instrumentation
 * 在服务器启动时执行，用于初始化后台任务运行器
 *
 * 需要在 next.config.js 中启用：
 * experimental: { instrumentationHook: true }
 */

export async function register() {
  // 只在服务器端运行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundRunner } = await import('@/lib/scheduler/background-runner')

    // 启动后台任务运行器，每 5 秒执行一次
    startBackgroundRunner(5 * 1000)
  }
}
