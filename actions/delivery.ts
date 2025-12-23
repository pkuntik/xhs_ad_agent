'use server'

import { ObjectId, type Db } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { campaignApi, reportApi } from '@/lib/xhs'
import type { XhsAccount, AccountThresholds } from '@/types/account'
import type { Work } from '@/types/work'
import type { Campaign } from '@/types/campaign'
import type { DeliveryLog, DeliveryDecision } from '@/types/delivery-log'
import { getCurrentUserId } from '@/lib/auth/session'
import { deductBalance } from '@/lib/billing/service'
import { ChipsAdvertiseTarget } from '@/lib/xhs/api/campaign'
import {
  BUDGET,
  BID,
  CHECK_INTERVAL,
  THRESHOLD,
  MANAGED_DELIVERY,
  TIME,
} from '@/lib/constants/delivery'

// 默认阈值配置
const DEFAULT_THRESHOLDS: AccountThresholds = {
  minConsumption: THRESHOLD.MIN_CONSUMPTION,
  maxCostPerLead: THRESHOLD.MAX_COST_PER_LEAD,
  maxFailRetries: MANAGED_DELIVERY.MAX_RETRIES,
}

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

    if (!account.cookie) {
      return { success: false, error: '账号 Cookie 未设置' }
    }
    if (!account.advertiserId) {
      return { success: false, error: '账号广告主 ID 未设置' }
    }

    const cookie = account.cookie
    const budget = options?.budget ?? BUDGET.DEFAULT
    const bidAmount = options?.bidAmount ?? account.defaultBidAmount ?? BID.DEFAULT_AMOUNT

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
      scheduledAt: new Date(Date.now() + CHECK_INTERVAL.SHORT * TIME.MINUTE_MS),
      params: { minConsumption: (account.thresholds ?? DEFAULT_THRESHOLDS).minConsumption },
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
  if (!account.cookie || !account.advertiserId) {
    throw new Error('账号未完成配置')
  }

  const work = await db
    .collection<Work>(COLLECTIONS.WORKS)
    .findOne({ _id: campaign.workId })
  if (!work) {
    throw new Error('作品不存在')
  }

  const cookie = account.cookie
  const advertiserId = account.advertiserId

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
      advertiserId,
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

  const isEffective = costPerLead <= (account.thresholds ?? DEFAULT_THRESHOLDS).maxCostPerLead

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
  if (reportData.spent < (account.thresholds ?? DEFAULT_THRESHOLDS).minConsumption) {
    logEntry.decision = 'continue'
    logEntry.decisionReason = '消耗未达到检查阈值，继续监控'

    await db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)
    await scheduleNextCheck(db, campaignId, CHECK_INTERVAL.SHORT)

    return { decision: 'continue', reason: '消耗未达到检查阈值' }
  }

  // 效果好，继续投放
  if (isEffective) {
    logEntry.decision = 'continue'
    logEntry.decisionReason = `效果达标（成本 ${costPerLead.toFixed(2)} <= ${(account.thresholds ?? DEFAULT_THRESHOLDS).maxCostPerLead}），继续投放`

    await db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)
    await scheduleNextCheck(db, campaignId, CHECK_INTERVAL.LONG)

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
  if (consecutiveFailures >= (account.thresholds ?? DEFAULT_THRESHOLDS).maxFailRetries) {
    logEntry.decision = 'switch_work'
    logEntry.decisionReason = `连续 ${consecutiveFailures} 次效果不佳，需要换作品`

    await db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)

    // 暂停当前计划
    try {
      if (campaign.orderNo) {
        await campaignApi.cancelChipsOrder({ cookie, orderNo: campaign.orderNo })
      } else if (campaign.campaignId) {
        await campaignApi.pauseCampaign({ cookie, campaignId: campaign.campaignId })
      }
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
  logEntry.decisionReason = `效果不佳（成本 ${costPerLead.toFixed(2)} > ${(account.thresholds ?? DEFAULT_THRESHOLDS).maxCostPerLead}），断掉重投`

  await db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)

  try {
    if (campaign.orderNo) {
      await campaignApi.cancelChipsOrder({ cookie, orderNo: campaign.orderNo })
    } else if (campaign.campaignId) {
      await campaignApi.pauseCampaign({ cookie, campaignId: campaign.campaignId })
    }
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
    scheduledAt: new Date(Date.now() + CHECK_INTERVAL.QUICK * TIME.MINUTE_MS),
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
      scheduledAt: new Date(Date.now() + minutesLater * TIME.MINUTE_MS),
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
    if (!account.cookie) {
      return { success: false, error: '账号 Cookie 未设置' }
    }

    const cookie = account.cookie

    try {
      if (campaign.orderNo) {
        await campaignApi.cancelChipsOrder({ cookie, orderNo: campaign.orderNo })
      } else if (campaign.campaignId) {
        await campaignApi.pauseCampaign({ cookie, campaignId: campaign.campaignId })
      }
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

    // 薯条订单不支持恢复，需要重新创建
    if (campaign.type === 'chips' || campaign.orderNo) {
      return { success: false, error: '薯条订单不支持恢复，请重新创建投放' }
    }

    const account = await db
      .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
      .findOne({ _id: campaign.accountId })
    if (!account) {
      return { success: false, error: '账号不存在' }
    }
    if (!account.cookie) {
      return { success: false, error: '账号 Cookie 未设置' }
    }

    const cookie = account.cookie

    try {
      if (campaign.campaignId) {
        await campaignApi.resumeCampaign({ cookie, campaignId: campaign.campaignId })
      }
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
    await scheduleNextCheck(db, campaignId, CHECK_INTERVAL.SHORT)

    return { success: true }
  } catch (error) {
    console.error('恢复投放失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

// ============================================
// 托管投放相关功能
// ============================================

import type { DeliveryConfig, DeliveryStats, DeliveryStatus, Publication } from '@/types/work'

// 默认托管配置
const DEFAULT_DELIVERY_CONFIG: DeliveryConfig = {
  enabled: false,
  budget: BUDGET.MANAGED_DEFAULT,
  duration: MANAGED_DELIVERY.DEFAULT_DURATION,
  checkThreshold1: THRESHOLD.CHECK_STAGE_1,
  checkThreshold2: THRESHOLD.CHECK_STAGE_2,
  minAttempts: MANAGED_DELIVERY.MIN_ATTEMPTS,
  minSuccessRate: MANAGED_DELIVERY.MIN_SUCCESS_RATE,
}

// 初始投放统计
const INITIAL_DELIVERY_STATS: DeliveryStats = {
  totalAttempts: 0,
  successfulAttempts: 0,
  totalSpent: 0,
  avgSpentPerAttempt: 0,
  successRate: 0,
  currentAttempt: 0,
}

/**
 * 更新 Publication 的托管配置
 */
export async function updateDeliveryConfig(
  workId: string,
  publicationIndex: number,
  config: Partial<DeliveryConfig>
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    const work = await db
      .collection<Work>(COLLECTIONS.WORKS)
      .findOne({ _id: new ObjectId(workId) })
    if (!work) {
      return { success: false, error: '作品不存在' }
    }
    if (!work.publications || !work.publications[publicationIndex]) {
      return { success: false, error: '笔记不存在' }
    }

    const publication = work.publications[publicationIndex]
    const currentConfig = publication.deliveryConfig || DEFAULT_DELIVERY_CONFIG
    const newConfig = { ...currentConfig, ...config }

    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: new ObjectId(workId) },
      {
        $set: {
          [`publications.${publicationIndex}.deliveryConfig`]: newConfig,
          updatedAt: new Date(),
        },
      }
    )

    return { success: true }
  } catch (error) {
    console.error('更新托管配置失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 开始托管投放
 * 只更新状态，实际订单创建由后台任务 processManagedDeliveries 处理
 */
export async function startManagedDelivery(
  workId: string,
  publicationIndex: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return { success: false, error: '请先登录' }
    }

    const db = await getDb()

    const work = await db
      .collection<Work>(COLLECTIONS.WORKS)
      .findOne({ _id: new ObjectId(workId) })
    if (!work) {
      return { success: false, error: '作品不存在' }
    }
    if (!work.publications || !work.publications[publicationIndex]) {
      return { success: false, error: '笔记不存在' }
    }

    const publication = work.publications[publicationIndex]
    if (!publication.noteId) {
      return { success: false, error: '笔记 ID 不存在' }
    }
    if (!publication.accountId) {
      return { success: false, error: '请先关联账号' }
    }

    // 检查是否已在投放中
    if (publication.deliveryStatus === 'running') {
      return { success: false, error: '该笔记已在托管投放中' }
    }

    // 获取账号信息
    const account = await db
      .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
      .findOne({ _id: new ObjectId(publication.accountId) })
    if (!account) {
      return { success: false, error: '账号不存在' }
    }
    if (account.status !== 'active') {
      return { success: false, error: '账号状态异常' }
    }
    if (!account.cookie) {
      return { success: false, error: '账号 Cookie 未设置' }
    }

    const config = publication.deliveryConfig || DEFAULT_DELIVERY_CONFIG
    const stats = publication.deliveryStats || INITIAL_DELIVERY_STATS

    // 只更新状态，标记为托管中，后台任务会处理实际的订单创建
    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: new ObjectId(workId) },
      {
        $set: {
          [`publications.${publicationIndex}.deliveryStatus`]: 'running' as DeliveryStatus,
          [`publications.${publicationIndex}.deliveryConfig`]: { ...config, enabled: true },
          [`publications.${publicationIndex}.deliveryStats`]: stats,
          status: 'promoting',
          updatedAt: new Date(),
        },
      }
    )

    return { success: true }
  } catch (error) {
    console.error('开始托管投放失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 停止托管投放
 */
export async function stopManagedDelivery(
  workId: string,
  publicationIndex: number,
  action: 'pause' | 'continue_no_restart'
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    const work = await db
      .collection<Work>(COLLECTIONS.WORKS)
      .findOne({ _id: new ObjectId(workId) })
    if (!work) {
      return { success: false, error: '作品不存在' }
    }
    if (!work.publications || !work.publications[publicationIndex]) {
      return { success: false, error: '笔记不存在' }
    }

    const publication = work.publications[publicationIndex]
    const campaignId = publication.currentCampaignId

    if (action === 'pause' && campaignId) {
      // 立即暂停当前投放
      const campaign = await db
        .collection<Campaign>(COLLECTIONS.CAMPAIGNS)
        .findOne({ _id: new ObjectId(campaignId) })

      if (campaign && campaign.status === 'active') {
        const account = await db
          .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
          .findOne({ _id: campaign.accountId })

        if (account && account.cookie) {
          try {
            // 薯条订单使用取消接口
            if (campaign.orderNo) {
              await campaignApi.cancelChipsOrder({
                cookie: account.cookie,
                orderNo: campaign.orderNo,
              })
            }
          } catch (e) {
            console.warn('取消薯条订单失败:', e)
          }
        }

        await db.collection(COLLECTIONS.CAMPAIGNS).updateOne(
          { _id: campaign._id },
          { $set: { status: 'paused', updatedAt: new Date() } }
        )
      }
    }

    // 更新 Publication 状态
    const newStatus: DeliveryStatus = action === 'pause' ? 'paused' : 'stopped'
    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: new ObjectId(workId) },
      {
        $set: {
          [`publications.${publicationIndex}.deliveryStatus`]: newStatus,
          [`publications.${publicationIndex}.deliveryConfig.enabled`]: false,
          updatedAt: new Date(),
        },
      }
    )

    // 取消所有相关的待执行任务
    await db.collection(COLLECTIONS.TASKS).updateMany(
      {
        workId: new ObjectId(workId),
        publicationIndex,
        status: 'pending',
        type: 'check_managed_campaign',
      },
      { $set: { status: 'cancelled' } }
    )

    return { success: true }
  } catch (error) {
    console.error('停止托管投放失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 手动标记加粉
 */
export async function markFollowerAdded(
  workId: string,
  publicationIndex: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    const work = await db
      .collection<Work>(COLLECTIONS.WORKS)
      .findOne({ _id: new ObjectId(workId) })
    if (!work) {
      return { success: false, error: '作品不存在' }
    }
    if (!work.publications || !work.publications[publicationIndex]) {
      return { success: false, error: '笔记不存在' }
    }

    const publication = work.publications[publicationIndex]
    const stats = publication.deliveryStats || INITIAL_DELIVERY_STATS

    // 更新统计：增加成功次数
    const newSuccessfulAttempts = stats.successfulAttempts + 1
    const newSuccessRate = stats.totalAttempts > 0
      ? (newSuccessfulAttempts / stats.totalAttempts) * 100
      : 0

    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: new ObjectId(workId) },
      {
        $set: {
          [`publications.${publicationIndex}.deliveryStats.successfulAttempts`]: newSuccessfulAttempts,
          [`publications.${publicationIndex}.deliveryStats.successRate`]: newSuccessRate,
          updatedAt: new Date(),
        },
      }
    )

    // 如果当前有投放计划，记录到投放日志
    if (publication.currentCampaignId) {
      await db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne({
        accountId: publication.accountId ? new ObjectId(publication.accountId) : undefined,
        workId: new ObjectId(workId),
        campaignId: new ObjectId(publication.currentCampaignId),
        publicationIndex,
        periodStart: new Date(),
        periodEnd: new Date(),
        spent: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        leads: 0,
        costPerLead: 0,
        conversionRate: 0,
        followers: 1,
        hasFollower: true,
        isEffective: true,
        decision: 'continue',
        decisionReason: '手动标记加粉成功',
        createdAt: new Date(),
      })
    }

    return { success: true }
  } catch (error) {
    console.error('标记加粉失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

// ============================================
// checkManagedCampaign 辅助函数
// ============================================

/** 检查参数配置 */
interface CheckParams {
  checkThreshold1: number
  checkThreshold2: number
  minAttempts: number
  minSuccessRate: number
}

/** 投放数据上下文 */
interface CampaignContext {
  db: Db
  campaign: Campaign
  work: Work
  publication: Publication
  account: XhsAccount
  stats: DeliveryStats
}

/** 报表数据 */
interface ReportData {
  spent: number
  impressions: number
  clicks: number
  ctr: number
  leads: number
  costPerLead: number
}

/**
 * 解析检查参数
 */
function parseCheckParams(params: Record<string, unknown>): CheckParams {
  return {
    checkThreshold1: (params.checkThreshold1 as number) || THRESHOLD.CHECK_STAGE_1,
    checkThreshold2: (params.checkThreshold2 as number) || THRESHOLD.CHECK_STAGE_2,
    minAttempts: (params.minAttempts as number) || MANAGED_DELIVERY.MIN_ATTEMPTS,
    minSuccessRate: (params.minSuccessRate as number) || MANAGED_DELIVERY.MIN_SUCCESS_RATE,
  }
}

/**
 * 获取投放相关数据
 */
async function fetchCampaignData(
  campaignId: string,
  workId: string,
  publicationIndex: number
): Promise<CampaignContext> {
  const db = await getDb()

  const campaign = await db
    .collection<Campaign>(COLLECTIONS.CAMPAIGNS)
    .findOne({ _id: new ObjectId(campaignId) })
  if (!campaign) {
    throw new Error('计划不存在')
  }

  const work = await db
    .collection<Work>(COLLECTIONS.WORKS)
    .findOne({ _id: new ObjectId(workId) })
  if (!work) {
    throw new Error('作品不存在')
  }
  if (!work.publications || !work.publications[publicationIndex]) {
    throw new Error('笔记不存在')
  }

  const publication = work.publications[publicationIndex]

  if (!publication.accountId) {
    throw new Error('笔记未关联账号')
  }

  const account = await db
    .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
    .findOne({ _id: new ObjectId(publication.accountId) })
  if (!account) {
    throw new Error('账号不存在')
  }
  if (!account.cookie || !account.advertiserId) {
    throw new Error('账号未完成配置')
  }

  const stats = publication.deliveryStats || INITIAL_DELIVERY_STATS

  return { db, campaign, work, publication, account, stats }
}

/**
 * 获取投放报表数据
 */
async function fetchReportData(
  account: XhsAccount,
  campaign: Campaign
): Promise<ReportData> {
  const defaultData: ReportData = {
    spent: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    leads: 0,
    costPerLead: 0,
  }

  try {
    return await reportApi.getReportData({
      cookie: account.cookie!,
      advertiserId: account.advertiserId!,
      campaignId: campaign.campaignId,
      startDate: campaign.batchStartAt,
      endDate: new Date(),
    })
  } catch {
    console.warn('报表 API 未实现，使用模拟数据')
    return defaultData
  }
}

/**
 * 创建检查日志条目
 */
function createCheckLogEntry(
  ctx: CampaignContext,
  reportData: ReportData,
  workId: string,
  publicationIndex: number
): Omit<DeliveryLog, '_id'> {
  return {
    accountId: new ObjectId(ctx.publication.accountId!),
    workId: new ObjectId(workId),
    campaignId: ctx.campaign._id,
    publicationIndex,
    periodStart: ctx.campaign.batchStartAt,
    periodEnd: new Date(),
    spent: reportData.spent,
    impressions: reportData.impressions,
    clicks: reportData.clicks,
    ctr: reportData.ctr,
    leads: reportData.leads,
    costPerLead: reportData.leads > 0 ? reportData.spent / reportData.leads : 0,
    conversionRate: reportData.clicks > 0 ? reportData.leads / reportData.clicks : 0,
    isEffective: false,
    decision: 'continue',
    decisionReason: '',
    createdAt: new Date(),
  }
}

/**
 * 处理阶段1检查：是否有咨询
 */
async function handleStage1Check(
  ctx: CampaignContext,
  reportData: ReportData,
  logEntry: Omit<DeliveryLog, '_id'>,
  campaignId: string,
  workId: string,
  publicationIndex: number,
  params: Record<string, unknown>
): Promise<{ decision: DeliveryDecision; reason: string } | null> {
  logEntry.checkStage = 1

  if (reportData.leads > 0) {
    logEntry.isEffective = true
    logEntry.decision = 'continue'
    logEntry.decisionReason = `阶段1有效：${reportData.leads}个咨询`

    await ctx.db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)
    await scheduleManagedCheck(ctx.db, campaignId, workId, publicationIndex, params, CHECK_INTERVAL.LONG)

    return { decision: 'continue', reason: '阶段1：有咨询，继续投放' }
  }

  logEntry.decision = 'continue'
  logEntry.decisionReason = '阶段1无咨询，等待阶段2检查'

  await ctx.db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)
  await scheduleManagedCheck(ctx.db, campaignId, workId, publicationIndex, params, CHECK_INTERVAL.SHORT)

  return { decision: 'continue', reason: '阶段1：无咨询，等待阶段2' }
}

/**
 * 处理阶段2检查：是否有加粉或咨询
 */
async function handleStage2Check(
  ctx: CampaignContext,
  reportData: ReportData,
  logEntry: Omit<DeliveryLog, '_id'>,
  campaignId: string,
  workId: string,
  publicationIndex: number,
  params: Record<string, unknown>,
  checkParams: CheckParams
): Promise<{ decision: DeliveryDecision; reason: string }> {
  logEntry.checkStage = 2

  // 查询最近的加粉记录
  const recentFollowerLog = await ctx.db
    .collection<DeliveryLog>(COLLECTIONS.DELIVERY_LOGS)
    .findOne({
      workId: new ObjectId(workId),
      publicationIndex,
      hasFollower: true,
      createdAt: { $gte: ctx.campaign.batchStartAt },
    })

  const hasFollower = !!recentFollowerLog
  logEntry.hasFollower = hasFollower

  if (hasFollower || reportData.leads > 0) {
    return await handleEffectiveStage2(
      ctx, reportData, logEntry, campaignId, workId, publicationIndex, params, hasFollower
    )
  }

  return await handleIneffectiveStage2(
    ctx, reportData, logEntry, workId, publicationIndex, checkParams
  )
}

/**
 * 处理阶段2有效果的情况
 */
async function handleEffectiveStage2(
  ctx: CampaignContext,
  reportData: ReportData,
  logEntry: Omit<DeliveryLog, '_id'>,
  campaignId: string,
  workId: string,
  publicationIndex: number,
  params: Record<string, unknown>,
  hasFollower: boolean
): Promise<{ decision: DeliveryDecision; reason: string }> {
  logEntry.isEffective = true
  logEntry.decision = 'continue'
  logEntry.decisionReason = hasFollower
    ? `阶段2有效：有企微加粉`
    : `阶段2有效：${reportData.leads}个咨询`

  await ctx.db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)

  await updateDeliveryStats(ctx.db, workId, publicationIndex, {
    totalSpent: ctx.stats.totalSpent + reportData.spent,
    successfulAttempts: ctx.stats.successfulAttempts + 1,
  })

  await scheduleManagedCheck(ctx.db, campaignId, workId, publicationIndex, params, CHECK_INTERVAL.LONG)

  return { decision: 'continue', reason: '阶段2：有效果，继续投放' }
}

/**
 * 处理阶段2无效果的情况：暂停计划并决定是否重投
 */
async function handleIneffectiveStage2(
  ctx: CampaignContext,
  reportData: ReportData,
  logEntry: Omit<DeliveryLog, '_id'>,
  workId: string,
  publicationIndex: number,
  checkParams: CheckParams
): Promise<{ decision: DeliveryDecision; reason: string }> {
  logEntry.isEffective = false
  logEntry.decision = 'restart'
  logEntry.decisionReason = '阶段2无效果（无咨询、无加粉），终止并重投'

  await ctx.db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)

  // 暂停当前计划
  await pauseCurrentCampaign(ctx)

  // 更新统计
  const newTotalAttempts = ctx.stats.totalAttempts
  const newSuccessRate = newTotalAttempts > 0
    ? (ctx.stats.successfulAttempts / newTotalAttempts) * 100
    : 0
  const newAvgSpent = newTotalAttempts > 0
    ? (ctx.stats.totalSpent + reportData.spent) / newTotalAttempts
    : 0

  await updateDeliveryStats(ctx.db, workId, publicationIndex, {
    totalSpent: ctx.stats.totalSpent + reportData.spent,
    avgSpentPerAttempt: newAvgSpent,
    successRate: newSuccessRate,
  })

  // 判断是否继续重投
  const shouldContinue =
    ctx.stats.totalAttempts < checkParams.minAttempts ||
    newSuccessRate >= checkParams.minSuccessRate

  if (!shouldContinue) {
    return await stopManagedDeliveryStatus(ctx.db, workId, publicationIndex, ctx.stats.totalAttempts, newSuccessRate, checkParams.minSuccessRate)
  }

  await startManagedDelivery(workId, publicationIndex)
  return { decision: 'restart', reason: '效果不佳，已创建新的投放计划' }
}

/**
 * 暂停当前投放计划
 */
async function pauseCurrentCampaign(ctx: CampaignContext): Promise<void> {
  try {
    if (ctx.campaign.orderNo) {
      await campaignApi.cancelChipsOrder({
        cookie: ctx.account.cookie!,
        orderNo: ctx.campaign.orderNo,
      })
    } else if (ctx.campaign.campaignId) {
      await campaignApi.pauseCampaign({
        cookie: ctx.account.cookie!,
        campaignId: ctx.campaign.campaignId,
      })
    }
  } catch (e) {
    console.warn('暂停计划 API 调用失败:', e)
  }

  await ctx.db.collection(COLLECTIONS.CAMPAIGNS).updateOne(
    { _id: ctx.campaign._id },
    { $set: { status: 'paused', updatedAt: new Date() } }
  )
}

/**
 * 停止托管投放状态
 */
async function stopManagedDeliveryStatus(
  db: Db,
  workId: string,
  publicationIndex: number,
  totalAttempts: number,
  successRate: number,
  minSuccessRate: number
): Promise<{ decision: DeliveryDecision; reason: string }> {
  await db.collection(COLLECTIONS.WORKS).updateOne(
    { _id: new ObjectId(workId) },
    {
      $set: {
        [`publications.${publicationIndex}.deliveryStatus`]: 'stopped',
        [`publications.${publicationIndex}.deliveryConfig.enabled`]: false,
        updatedAt: new Date(),
      },
    }
  )

  return {
    decision: 'pause',
    reason: `投放${totalAttempts}次，起量率${successRate.toFixed(1)}%低于${minSuccessRate}%，停止托管`,
  }
}

// ============================================
// 主检查函数
// ============================================

/**
 * 检查托管投放效果（两阶段检查）
 *
 * 阶段1（消耗 >= threshold1）：检查是否有私信咨询
 * 阶段2（消耗 >= threshold2）：检查是否有企微加粉
 *
 * 如果两个阶段都没有效果，终止当前投放并重新创建
 */
export async function checkManagedCampaign(
  campaignId: string,
  workId: string,
  publicationIndex: number,
  params: Record<string, unknown>
): Promise<{ decision: DeliveryDecision; reason: string }> {
  const checkParams = parseCheckParams(params)
  const ctx = await fetchCampaignData(campaignId, workId, publicationIndex)

  // 检查托管状态
  if (ctx.publication.deliveryStatus !== 'running') {
    return { decision: 'pause', reason: '托管投放已关闭' }
  }

  const reportData = await fetchReportData(ctx.account, ctx.campaign)
  const logEntry = createCheckLogEntry(ctx, reportData, workId, publicationIndex)

  // 判断检查阶段
  if (reportData.spent < checkParams.checkThreshold1) {
    // 消耗未达到阈值，继续监控
    logEntry.decision = 'continue'
    logEntry.decisionReason = '消耗未达到检查阈值，继续监控'
    logEntry.checkStage = 1

    await ctx.db.collection(COLLECTIONS.DELIVERY_LOGS).insertOne(logEntry)
    await scheduleManagedCheck(ctx.db, campaignId, workId, publicationIndex, params, CHECK_INTERVAL.SHORT)

    return { decision: 'continue', reason: '消耗未达到检查阈值' }
  }

  // 阶段1检查
  if (reportData.spent < checkParams.checkThreshold2) {
    return (await handleStage1Check(
      ctx, reportData, logEntry, campaignId, workId, publicationIndex, params
    ))!
  }

  // 阶段2检查
  return await handleStage2Check(
    ctx, reportData, logEntry, campaignId, workId, publicationIndex, params, checkParams
  )
}

/**
 * 更新投放统计
 */
async function updateDeliveryStats(
  db: Db,
  workId: string,
  publicationIndex: number,
  updates: Partial<DeliveryStats>
) {
  const setFields: Record<string, unknown> = { updatedAt: new Date() }

  for (const [key, value] of Object.entries(updates)) {
    setFields[`publications.${publicationIndex}.deliveryStats.${key}`] = value
  }

  await db.collection(COLLECTIONS.WORKS).updateOne(
    { _id: new ObjectId(workId) },
    { $set: setFields }
  )
}

/**
 * 安排下次托管检查
 */
async function scheduleManagedCheck(
  db: Db,
  campaignId: string,
  workId: string,
  publicationIndex: number,
  params: Record<string, unknown>,
  minutesLater: number
) {
  const campaign = await db
    .collection<Campaign>(COLLECTIONS.CAMPAIGNS)
    .findOne({ _id: new ObjectId(campaignId) })

  if (campaign) {
    await db.collection(COLLECTIONS.TASKS).insertOne({
      type: 'check_managed_campaign',
      accountId: campaign.accountId,
      workId: new ObjectId(workId),
      campaignId: new ObjectId(campaignId),
      publicationIndex,
      status: 'pending',
      priority: 2,
      scheduledAt: new Date(Date.now() + minutesLater * TIME.MINUTE_MS),
      params,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
    })
  }
}

// ============================================
// 托管投放后台处理
// ============================================

interface ManagedDeliveryResult {
  workId: string
  publicationIndex: number
  action: 'created' | 'monitoring' | 'skipped' | 'error'
  orderNo?: string
  error?: string
}

/**
 * 处理所有托管中的投放
 * 由 Cron 定时调用
 */
export async function processManagedDeliveries(): Promise<{
  processed: number
  results: ManagedDeliveryResult[]
}> {
  const results: ManagedDeliveryResult[] = []

  try {
    const db = await getDb()

    // 查找所有托管中的作品
    const works = await db
      .collection<Work>(COLLECTIONS.WORKS)
      .find({
        'publications.deliveryStatus': 'running',
      })
      .toArray()

    for (const work of works) {
      if (!work.publications) continue

      for (let i = 0; i < work.publications.length; i++) {
        const publication = work.publications[i]

        // 只处理托管中的笔记
        if (publication.deliveryStatus !== 'running') continue
        if (!publication.noteId || !publication.accountId) continue

        const result = await processOnePublication(db, work, i, publication)
        results.push(result)
      }
    }

    return { processed: results.length, results }
  } catch (error) {
    console.error('处理托管投放失败:', error)
    return { processed: 0, results }
  }
}

/**
 * 处理单个 Publication 的托管逻辑
 */
async function processOnePublication(
  db: Db,
  work: Work,
  publicationIndex: number,
  publication: NonNullable<Work['publications']>[number]
): Promise<ManagedDeliveryResult> {
  const workId = work._id.toString()

  try {
    // 获取账号信息
    const account = await db
      .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
      .findOne({ _id: new ObjectId(publication.accountId!) })

    if (!account || !account.cookie || account.status !== 'active') {
      return {
        workId,
        publicationIndex,
        action: 'skipped',
        error: '账号不可用',
      }
    }

    // 检查是否有活跃的投放订单
    const activeCampaign = await db
      .collection<Campaign>(COLLECTIONS.CAMPAIGNS)
      .findOne({
        workId: work._id,
        status: 'active',
        type: 'chips',
      })

    if (activeCampaign) {
      // 有活跃订单，检查是否已有检查任务
      const existingTask = await db.collection(COLLECTIONS.TASKS).findOne({
        campaignId: activeCampaign._id,
        type: 'check_managed_campaign',
        status: 'pending',
      })

      if (!existingTask) {
        // 没有检查任务，创建一个
        const config = publication.deliveryConfig || DEFAULT_DELIVERY_CONFIG
        await scheduleManagedCheck(
          db,
          activeCampaign._id.toString(),
          workId,
          publicationIndex,
          {
            checkThreshold1: config.checkThreshold1,
            checkThreshold2: config.checkThreshold2,
            minAttempts: config.minAttempts,
            minSuccessRate: config.minSuccessRate,
          },
          30 // 30分钟后检查
        )
      }

      return {
        workId,
        publicationIndex,
        action: 'monitoring',
        orderNo: activeCampaign.orderNo,
      }
    }

    // 没有活跃订单，创建新订单
    const config = publication.deliveryConfig || DEFAULT_DELIVERY_CONFIG
    const stats = publication.deliveryStats || INITIAL_DELIVERY_STATS

    // 调用薯条 API 创建投放订单
    const chipsResult = await campaignApi.createChipsOrder({
      cookie: account.cookie,
      order: {
        noteId: publication.noteId!,
        advertiseTarget: ChipsAdvertiseTarget.PRIVATE_MESSAGE,
        budget: config.budget * 100,  // 元转分
        totalTime: config.duration || MANAGED_DELIVERY.DEFAULT_DURATION,
        planStartTime: 0,
        smartTarget: 0,
      },
    })

    if (!chipsResult.success) {
      return {
        workId,
        publicationIndex,
        action: 'error',
        error: chipsResult.error || '创建订单失败',
      }
    }

    // 保存计划到数据库
    const campaign: Omit<Campaign, '_id'> = {
      accountId: new ObjectId(publication.accountId!),
      workId: work._id,
      type: 'chips',
      orderNo: chipsResult.orderNo,
      name: `托管投放 - ${publication.noteDetail?.title || publication.noteId}`,
      objective: 'lead_collection',
      budget: config.budget,
      duration: config.duration || MANAGED_DELIVERY.DEFAULT_DURATION,
      targeting: {},
      status: 'active',
      currentBatch: stats.currentAttempt + 1,
      batchStartAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const insertResult = await db.collection(COLLECTIONS.CAMPAIGNS).insertOne(campaign)
    const campaignId = insertResult.insertedId.toString()

    // 更新 Publication 状态
    await db.collection(COLLECTIONS.WORKS).updateOne(
      { _id: work._id },
      {
        $set: {
          [`publications.${publicationIndex}.currentCampaignId`]: campaignId,
          [`publications.${publicationIndex}.deliveryStats.totalAttempts`]: stats.totalAttempts + 1,
          [`publications.${publicationIndex}.deliveryStats.currentAttempt`]: stats.currentAttempt + 1,
          [`publications.${publicationIndex}.deliveryStats.lastAttemptAt`]: new Date(),
          updatedAt: new Date(),
        },
      }
    )

    // 创建效果检查任务（30分钟后）
    await scheduleManagedCheck(
      db,
      campaignId,
      workId,
      publicationIndex,
      {
        checkThreshold1: config.checkThreshold1,
        checkThreshold2: config.checkThreshold2,
        minAttempts: config.minAttempts,
        minSuccessRate: config.minSuccessRate,
      },
      30
    )

    return {
      workId,
      publicationIndex,
      action: 'created',
      orderNo: chipsResult.orderNo,
    }
  } catch (error) {
    console.error(`处理 Publication ${workId}/${publicationIndex} 失败:`, error)
    return {
      workId,
      publicationIndex,
      action: 'error',
      error: error instanceof Error ? error.message : '未知错误',
    }
  }
}
