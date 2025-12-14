import { NextRequest, NextResponse } from 'next/server'
import { processPendingTasks } from '@/actions/task'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Cron 任务端点
 *
 * 由 Vercel Cron 每5分钟调用一次
 * 处理待执行的任务队列
 */
export async function GET(request: NextRequest) {
  // 验证请求来源
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[Cron] 开始处理待执行任务...')

    const { processed, results } = await processPendingTasks()

    console.log(`[Cron] 处理完成，共处理 ${processed} 个任务`)

    return NextResponse.json({
      success: true,
      processed,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] 任务处理失败:', error)
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

// 同时支持 POST 方法（方便手动触发测试）
export async function POST(request: NextRequest) {
  return GET(request)
}
