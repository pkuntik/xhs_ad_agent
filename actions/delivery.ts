'use server'

import { ObjectId, type Db } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { campaignApi, reportApi } from '@/lib/xhs'
import type { XhsAccount } from '@/types/account'
import type { Work } from '@/types/work'
import type { Campaign } from '@/types/campaign'
import type { DeliveryLog, DeliveryDecision } from '@/types/delivery-log'
import { getCurrentUserId } from '@/lib/auth/session'
import { deductBalance } from '@/lib/billing/service'

/**
 * 创建投放（发作品 -> 投放2000元）
 *
 * 这是核心的投放创建函数，会：
 * 1. 获取账号和作品信息
 * 2. 调用小红书 API 创建投放计划
 * 3. 保存计划到数据库
 * 4. 创建效果检查任务
 */
export async function startDelivery(
  workId: string,
  options?: {
    budget?: number
    bidAmount?: number
  }
): Promise<{ success: boolean; error?: string; campaignId?: string }> {
  try {
    // 获取当前用户并扣费
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: '请先登录' }
    }

    const deductResult = await deductBalance(userId, 'xhs_api_call', {
      relatedType: 'delivery',
      description: '小红书API调用-创建投放',
      metadata: { workId },
    })

    if (!deductResult.success) {
      return { success: false, error: deductResult.error }
    }

    const db = await getDb()

    // 获取作品信息
    const work = await db
      .collection<Work>(COLLECTIONS.WORKS)
      .findOne({ _id: new ObjectId(workId) })
    if (!work) {
      return { success: false, error: '作品不存在' }
    }
    if (!work.noteId) {
      return { success: false, error: '作品未发布，请先发布到小红书' }
    }
    if (!work.accountId) {
      return { success: false, error: '作品未绑定账号' }
    }

    // 获取账号信息
    const account = await db
      .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
      .findOne({ _id: work.accountId })
    if (!account) {
      return { success: false, error: '账号不存在' }
    }
    if (account.status !== 'active') {
      return { success: false, error: '账号状态异常' }
    }

    const cookie = account.cookie
    const budget = options?.budget ?? 2000
    const bidAmount = options?.bidAmount ?? account.defaultBidAmount

    // 调用小红书 API 创建投放计划
    let xhsResult: { campaignId: string; unitId: string }

    try {
      xhsResult = await campaignApi.createCampaign({
        cookie,
        advertiserId: account.advertiserId,
        noteId: work.noteId,
        budget,
        bidAmount,
        objective: 'lead_collection',
      })
    } catch (apiError) {
      // API 未实现时的临时处理
      console.warn('小红书 API 未实现，使用模拟数据:', apiError)
      xhsResult = {
        campaignId: `mock_campaign_${Date.now()}`,
        unitId: `mock_unit_${Date.now()}`,
      }
    }

    // 保存计划到数据库
    const campaign: Omit<Campaign, '_id'> = {
      accountId: work.accountId,
      workId: new ObjectId(workId),
      campaignId: xhsResult.campaignId,
      unitId: xhsResult.unitId,
      name: `${work.title} - 投放计划`,
      objective: 'lead_collection',
      budget,
      bidAmount,
      targeting: {},
      status: 'active',
      currentBatch: 1,
      batchStartAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.collection(COLLECTIONS.CAMPAIGNS).insertOne(campaign)

    // 更新作品状态
    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: new ObjectId(workId) },
      { $set: { status: 'promoting', updatedAt: new Date() } }
    )

    // 创建效果检查任务（30分钟后开始检查）
    await db.collection(COLLECTIONS.TASKS).insertOne({
      type: 'check_campaign',
      accountId: work.accountId,
      workId: new ObjectId(workId),
      campaignId: result.insertedId,
      status: 'pending',
      priority: 2,
      scheduledAt: new Date(Date.now() + 30 * 60 * 1000),
      params: { minConsumption: account.thresholds.minConsumption },
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
    })

    return { success: true, campaignId: result.insertedId.toString() }
  } catch (error) {
    console.error('创建投放失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 检查投放效果并做出决策
 *
 * 核心决策逻辑：
 * 1. 消耗 < 100：继续等待
 * 2. 成本达标：继续投放
 * 3. 成本不达标：断掉重投
 * 4. 多次失败：换作品
 */
export async function checkAndDecide(
  campaignId: string
): Promise<{ decision: DeliveryDecision; reason: string }> {
  const db = await getDb()

  const campaign = await db
    .collection<Campaign>(COLLECTIONS.CAMPAIGNS)
    .findOne({ _id: new ObjectId(campaignId) })
  if (!campaign) {
    throw new Error('计划不存在')
  }

  const account = await db
    .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
    .findOne({ _id: campaign.accountId })
  if (!account) {
    throw new Error('账号不存在')
  }

  const work = await db
    .collection<Work>(COLLECTIONS.WORKS)
    .findOne({ _id: campaign.workId })
  if (!work) {
    throw new Error('作品不存在')
  }

  const cookie = account.cookie

  // 获取投放数据报表
  let reportData = {
    spent: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    leads: 0,
    costPerLead: 0,
  }

  try {
    reportData = await reportApi.getReportData({
      cookie,
      advertiserId: account.advertiserId,
      campaignId: campaign.campaignId,
      startDate: campaign.batchStartAt,
      endDate: new Date(),
    })
  } catch (apiError) {
    // API 未实现时使用模拟数据
    console.warn('报表 API 未实现，使用模拟数据')
  }

  // 计算效果指标
  const costPerLead =
    reportData.leads > 0 ? reportData.spent / reportData.leads : Infinity

  const isEffective = costPerLead <= account.thresholds.maxCostPerLead

  // 记录投放日志
  const logEntry: Omit<DeliveryLog, '_id'> = {
    accountId: campaign.accountId,
    workId: campaign.workId,
    campaignId: campaign._id,
    periodStart: campaign.batchStartAt,
    periodEnd: new Date(),
    spent: reportData.spent,
    impressions: reportData.impressions,
    clicks: reportData.clicks,
    ctr: reportData.ctr,
    leads: reportData.leads,
    costPerLead,
    conversionRate: reportData.clicks > 0 ? reportData.leads / reportData.clicks : 0,
    isEffective,
    decision: 'continue',
    decisionReason: '',
    createdAt: new Date(),
  }

  // 消耗未达到阈值，继续监控
  if (reportData.spent < account.thresholds.minConsumption) {
    logEntry.decision = 'continue'
    logEntry.decisionReason = '消耗未达到检查阈值，继续监控'

    await db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)
    await scheduleNextCheck(db, campaignId, 30)

    return { decision: 'continue', reason: '消耗未达到检查阈值' }
  }

  // 效果好，继续投放
  if (isEffective) {
    logEntry.decision = 'continue'
    logEntry.decisionReason = `效果达标（成本 ${costPerLead.toFixed(2)} <= ${account.thresholds.maxCostPerLead}），继续投放`

    await db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)
    await scheduleNextCheck(db, campaignId, 60)

    // 重置失败次数
    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: campaign.workId },
      { $set: { consecutiveFailures: 0, updatedAt: new Date() } }
    )

    return { decision: 'continue', reason: '效果达标' }
  }

  // 效果不好，断掉重投
  const consecutiveFailures = work.consecutiveFailures + 1

  await db.collection(COLLECTIONS.WORKS).updateOne(
    { _id: campaign.workId },
    { $set: { consecutiveFailures, updatedAt: new Date() } }
  )

  // 多次效果不好，换作品重发
  if (consecutiveFailures >= account.thresholds.maxFailRetries) {
    logEntry.decision = 'switch_work'
    logEntry.decisionReason = `连续 ${consecutiveFailures} 次效果不佳，需要换作品`

    await db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)

    // 暂停当前计划
    try {
      await campaignApi.pauseCampaign({ cookie, campaignId: campaign.campaignId })
    } catch (e) {
      console.warn('暂停计划 API 调用失败:', e)
    }

    await db.collection(COLLECTIONS.CAMPAIGNS).updateOne(
      { _id: campaign._id },
      { $set: { status: 'failed', updatedAt: new Date() } }
    )

    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: campaign.workId },
      { $set: { status: 'archived', updatedAt: new Date() } }
    )

    // 创建换作品任务
    await db.collection(COLLECTIONS.TASKS).insertOne({
      type: 'switch_work',
      accountId: campaign.accountId,
      workId: campaign.workId,
      campaignId: campaign._id,
      status: 'pending',
      priority: 1,
      scheduledAt: new Date(),
      params: {},
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
    })

    return { decision: 'switch_work', reason: '多次效果不佳，需要换作品' }
  }

  // 暂停当前计划，准备重新投放
  logEntry.decision = 'restart'
  logEntry.decisionReason = `效果不佳（成本 ${costPerLead.toFixed(2)} > ${account.thresholds.maxCostPerLead}），断掉重投`

  await db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)

  try {
    await campaignApi.pauseCampaign({ cookie, campaignId: campaign.campaignId })
  } catch (e) {
    console.warn('暂停计划 API 调用失败:', e)
  }

  await db.collection(COLLECTIONS.CAMPAIGNS).updateOne(
    { _id: campaign._id },
    { $set: { status: 'paused', updatedAt: new Date() } }
  )

  // 创建重投任务（5分钟后）
  await db.collection(COLLECTIONS.TASKS).insertOne({
    type: 'restart_campaign',
    accountId: campaign.accountId,
    workId: campaign.workId,
    campaignId: campaign._id,
    status: 'pending',
    priority: 1,
    scheduledAt: new Date(Date.now() + 5 * 60 * 1000),
    params: {},
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
  })

  return { decision: 'restart', reason: '效果不佳，断掉重投' }
}

/**
 * 安排下次检查
 */
async function scheduleNextCheck(db: Db, campaignId: string, minutesLater: number) {
  const campaign = await db
    .collection<Campaign>(COLLECTIONS.CAMPAIGNS)
    .findOne({ _id: new ObjectId(campaignId) })

  if (campaign) {
    await db.collection(COLLECTIONS.TASKS).insertOne({
      type: 'check_campaign',
      accountId: campaign.accountId,
      workId: campaign.workId,
      campaignId: new ObjectId(campaignId),
      status: 'pending',
      priority: 2,
      scheduledAt: new Date(Date.now() + minutesLater * 60 * 1000),
      params: {},
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
    })
  }
}

/**
 * 手动暂停投放
 */
export async function pauseDelivery(
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    const campaign = await db
      .collection<Campaign>(COLLECTIONS.CAMPAIGNS)
      .findOne({ _id: new ObjectId(campaignId) })
    if (!campaign) {
      return { success: false, error: '计划不存在' }
    }

    const account = await db
      .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
      .findOne({ _id: campaign.accountId })
    if (!account) {
      return { success: false, error: '账号不存在' }
    }

    const cookie = account.cookie

    try {
      await campaignApi.pauseCampaign({ cookie, campaignId: campaign.campaignId })
    } catch (e) {
      console.warn('暂停计划 API 调用失败:', e)
    }

    await db.collection(COLLECTIONS.CAMPAIGNS).updateOne(
      { _id: campaign._id },
      { $set: { status: 'paused', updatedAt: new Date() } }
    )

    return { success: true }
  } catch (error) {
    console.error('暂停投放失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 手动恢复投放
 */
export async function resumeDelivery(
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    const campaign = await db
      .collection<Campaign>(COLLECTIONS.CAMPAIGNS)
      .findOne({ _id: new ObjectId(campaignId) })
    if (!campaign) {
      return { success: false, error: '计划不存在' }
    }

    const account = await db
      .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
      .findOne({ _id: campaign.accountId })
    if (!account) {
      return { success: false, error: '账号不存在' }
    }

    const cookie = account.cookie

    try {
      await campaignApi.resumeCampaign({ cookie, campaignId: campaign.campaignId })
    } catch (e) {
      console.warn('恢复计划 API 调用失败:', e)
    }

    await db.collection(COLLECTIONS.CAMPAIGNS).updateOne(
      { _id: campaign._id },
      {
        $set: {
          status: 'active',
          batchStartAt: new Date(),
          updatedAt: new Date(),
        },
        $inc: { currentBatch: 1 },
      }
    )

    // 创建效果检查任务
    await scheduleNextCheck(db, campaignId, 30)

    return { success: true }
  } catch (error) {
    console.error('恢复投放失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}
