import { NextRequest, NextResponse } from 'next/server'
import { processPendingTasks } from '@/actions/task'
import { syncPendingNotes } from '@/actions/note'
import { processManagedDeliveries } from '@/actions/delivery'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Cron 任务端点
 *
 * 由 Vercel Cron 每5分钟调用一次
 * 处理待执行的任务队列、托管投放和笔记数据同步
 */
export async function GET(request: NextRequest) {
  // 验证请求来源
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[Cron] 开始处理待执行任务...')

    // 处理任务队列
    const { processed, results } = await processPendingTasks()
    console.log(`[Cron] 任务处理完成，共处理 ${processed} 个任务`)

    // 处理托管投放
    console.log('[Cron] 开始处理托管投放...')
    const managedResult = await processManagedDeliveries()
    console.log(`[Cron] 托管投放处理完成，共处理 ${managedResult.processed} 个`)

    // 同步笔记数据
    console.log('[Cron] 开始同步笔记数据...')
    const syncResult = await syncPendingNotes()
    console.log(`[Cron] 笔记同步完成，成功 ${syncResult.synced} 个，失败 ${syncResult.errors} 个`)

    return NextResponse.json({
      success: true,
      tasks: { processed, results },
      managedDeliveries: managedResult,
      noteSync: {
        synced: syncResult.synced,
        errors: syncResult.errors,
      },
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
