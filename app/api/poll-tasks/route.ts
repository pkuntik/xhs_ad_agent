import { NextRequest, NextResponse } from 'next/server'
import { processPendingTasks } from '@/actions/task'

/**
 * 轮询任务执行端点
 *
 * 由客户端定时调用，用于执行待处理的任务
 * 这是一个内部 API，不需要外部认证
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Poll] 开始处理待执行任务...')

    const { processed, results } = await processPendingTasks()

    console.log(`[Poll] 处理完成，共处理 ${processed} 个任务`)

    return NextResponse.json({
      success: true,
      processed,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Poll] 任务处理失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
