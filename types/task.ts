import { ObjectId } from 'mongodb'

// 任务类型
export type TaskType =
  | 'sync_account'        // 同步账号数据
  | 'check_campaign'      // 检查投放效果
  | 'create_campaign'     // 创建投放计划
  | 'pause_campaign'      // 暂停计划
  | 'restart_campaign'    // 重启计划
  | 'switch_work'         // 切换作品

// 任务状态
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

// 系统任务
export interface SystemTask {
  _id: ObjectId

  // 任务类型
  type: TaskType

  // 关联实体
  accountId?: ObjectId
  workId?: ObjectId
  campaignId?: ObjectId

  // 任务参数
  params: Record<string, unknown>

  // 执行状态
  status: TaskStatus
  priority: number                // 优先级 (越小越高)

  // 调度信息
  scheduledAt: Date               // 计划执行时间
  startedAt?: Date
  completedAt?: Date

  // 结果
  result?: Record<string, unknown>
  error?: string
  retryCount: number
  maxRetries: number

  createdAt: Date
}

// 创建任务的输入
export interface CreateTaskInput {
  type: TaskType
  accountId?: string
  workId?: string
  campaignId?: string
  params?: Record<string, unknown>
  priority?: number
  scheduledAt?: Date
  maxRetries?: number
}
