'use server'

import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import type { SystemTask, TaskType, TaskStatus, CreateTaskInput } from '@/types/task'

/**
 * 获取待执行的任务
 */
export async function getPendingTasks(limit: number = 10): Promise<SystemTask[]> {
  const db = await getDb()

  const tasks = await db
    .collection<SystemTask>(COLLECTIONS.TASKS)
    .find({
      status: 'pending',
      scheduledAt: { $lte: new Date() },
    })
    .sort({ priority: 1, scheduledAt: 1 })
    .limit(limit)
    .toArray()

  return tasks
}

/**
 * 创建任务
 */
export async function createTask(input: CreateTaskInput): Promise<string> {
  const db = await getDb()

  const task: Omit<SystemTask, '_id'> = {
    type: input.type,
    accountId: input.accountId ? new ObjectId(input.accountId) : undefined,
    workId: input.workId ? new ObjectId(input.workId) : undefined,
    campaignId: input.campaignId ? new ObjectId(input.campaignId) : undefined,
    params: input.params || {},
    status: 'pending',
    priority: input.priority ?? 2,
    scheduledAt: input.scheduledAt || new Date(),
    retryCount: 0,
    maxRetries: input.maxRetries ?? 3,
    createdAt: new Date(),
  }

  const result = await db.collection(COLLECTIONS.TASKS).insertOne(task)
  return result.insertedId.toString()
}

/**
 * 执行单个任务
 */
export async function executeTask(
  taskId: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const db = await getDb()

  const task = await db
    .collection<SystemTask>(COLLECTIONS.TASKS)
    .findOne({ _id: new ObjectId(taskId) })
  if (!task) {
    return { success: false, error: '任务不存在' }
  }

  // 标记任务开始执行
  await db.collection(COLLECTIONS.TASKS).updateOne(
    { _id: task._id },
    { $set: { status: 'running' as TaskStatus, startedAt: new Date() } }
  )

  try {
    let result: unknown

    switch (task.type) {
      case 'sync_account':
        result = await executeSyncAccount(task)
        break
      case 'check_campaign':
        result = await executeCheckCampaign(task)
        break
      case 'check_managed_campaign':
        result = await executeCheckManagedCampaign(task)
        break
      case 'restart_campaign':
        result = await executeRestartCampaign(task)
        break
      case 'switch_work':
        result = await executeSwitchWork(task)
        break
      case 'pause_campaign':
        result = await executePauseCampaign(task)
        break
      default:
        throw new Error(`未知任务类型: ${task.type}`)
    }

    // 标记任务完成
    await db.collection(COLLECTIONS.TASKS).updateOne(
      { _id: task._id },
      {
        $set: {
          status: 'completed' as TaskStatus,
          completedAt: new Date(),
          result: result as Record<string, unknown>,
        },
      }
    )

    return { success: true, result }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // 重试或标记失败
    if (task.retryCount < task.maxRetries) {
      await db.collection(COLLECTIONS.TASKS).updateOne(
        { _id: task._id },
        {
          $set: {
            status: 'pending' as TaskStatus,
            scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // 5分钟后重试
          },
          $inc: { retryCount: 1 },
        }
      )
    } else {
      await db.collection(COLLECTIONS.TASKS).updateOne(
        { _id: task._id },
        {
          $set: {
            status: 'failed' as TaskStatus,
            completedAt: new Date(),
            error: errorMessage,
          },
        }
      )
    }

    return { success: false, error: errorMessage }
  }
}

/**
 * 执行同步账号任务
 */
async function executeSyncAccount(task: SystemTask): Promise<unknown> {
  if (!task.accountId) {
    throw new Error('缺少 accountId')
  }

  // TODO: 实现账号数据同步
  // 调用小红书 API 获取账号余额等信息
  console.log('执行同步账号任务:', task.accountId.toString())

  return { synced: true }
}

/**
 * 执行检查投放效果任务
 */
async function executeCheckCampaign(task: SystemTask): Promise<unknown> {
  if (!task.campaignId) {
    throw new Error('缺少 campaignId')
  }

  const { checkAndDecide } = await import('./delivery')
  return checkAndDecide(task.campaignId.toString())
}

/**
 * 执行重启投放任务
 */
async function executeRestartCampaign(task: SystemTask): Promise<unknown> {
  if (!task.workId) {
    throw new Error('缺少 workId')
  }

  const { startDelivery } = await import('./delivery')
  return startDelivery(task.workId.toString(), {
    budget: 2000,
  })
}

/**
 * 执行切换作品任务
 */
async function executeSwitchWork(task: SystemTask): Promise<unknown> {
  if (!task.accountId) {
    throw new Error('缺少 accountId')
  }

  const db = await getDb()

  // 找到下一个可用作品
  const { getNextBestWork } = await import('./work')
  const nextWork = await getNextBestWork(
    task.accountId.toString(),
    task.workId?.toString()
  )

  if (!nextWork) {
    return { success: false, reason: '没有可用的作品' }
  }

  // 使用新作品创建投放
  const { startDelivery } = await import('./delivery')
  return startDelivery(nextWork._id.toString())
}

/**
 * 执行暂停投放任务
 */
async function executePauseCampaign(task: SystemTask): Promise<unknown> {
  if (!task.campaignId) {
    throw new Error('缺少 campaignId')
  }

  const { pauseDelivery } = await import('./delivery')
  return pauseDelivery(task.campaignId.toString())
}

/**
 * 执行托管投放检查任务（两阶段检查）
 */
async function executeCheckManagedCampaign(task: SystemTask): Promise<unknown> {
  if (!task.campaignId) {
    throw new Error('缺少 campaignId')
  }
  if (!task.workId) {
    throw new Error('缺少 workId')
  }

  const publicationIndex = (task.params as { publicationIndex?: number }).publicationIndex
  if (publicationIndex === undefined) {
    throw new Error('缺少 publicationIndex')
  }

  const { checkManagedCampaign } = await import('./delivery')
  return checkManagedCampaign(
    task.campaignId.toString(),
    task.workId.toString(),
    publicationIndex,
    task.params as Record<string, unknown>
  )
}

/**
 * 批量处理待执行任务（由 Cron 调用）
 */
export async function processPendingTasks(): Promise<{
  processed: number
  results: { taskId: string; success: boolean; error?: string }[]
}> {
  const tasks = await getPendingTasks(5)
  const results: { taskId: string; success: boolean; error?: string }[] = []

  for (const task of tasks) {
    const result = await executeTask(task._id.toString())
    results.push({
      taskId: task._id.toString(),
      success: result.success,
      error: result.error,
    })
  }

  return { processed: tasks.length, results }
}

/**
 * 获取任务列表
 */
export async function getTasks(filters?: {
  type?: TaskType
  status?: TaskStatus
  accountId?: string
  limit?: number
}): Promise<SystemTask[]> {
  const db = await getDb()

  const query: Record<string, unknown> = {}
  if (filters?.type) query.type = filters.type
  if (filters?.status) query.status = filters.status
  if (filters?.accountId) query.accountId = new ObjectId(filters.accountId)

  const tasks = await db
    .collection<SystemTask>(COLLECTIONS.TASKS)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(filters?.limit || 50)
    .toArray()

  return tasks
}

/**
 * 取消任务
 */
export async function cancelTask(taskId: string): Promise<{ success: boolean }> {
  const db = await getDb()

  await db.collection(COLLECTIONS.TASKS).updateOne(
    { _id: new ObjectId(taskId), status: 'pending' },
    { $set: { status: 'failed' as TaskStatus, error: '手动取消', completedAt: new Date() } }
  )

  return { success: true }
}
