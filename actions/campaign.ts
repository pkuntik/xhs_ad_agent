'use server'

import { revalidatePath } from 'next/cache'
import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import type { Campaign, CreateCampaignInput, CampaignStatus } from '@/types/campaign'

/**
 * 获取投放计划列表
 */
export async function getCampaigns(filters?: {
  accountId?: string
  workId?: string
  status?: CampaignStatus
}): Promise<Campaign[]> {
  const db = await getDb()

  const query: Record<string, unknown> = {}
  if (filters?.accountId) query.accountId = new ObjectId(filters.accountId)
  if (filters?.workId) query.workId = new ObjectId(filters.workId)
  if (filters?.status) query.status = filters.status

  const campaigns = await db
    .collection<Campaign>(COLLECTIONS.CAMPAIGNS)
    .find(query)
    .sort({ createdAt: -1 })
    .toArray()

  return campaigns
}

/**
 * 获取单个计划详情
 */
export async function getCampaignById(id: string): Promise<Campaign | null> {
  const db = await getDb()
  const campaign = await db
    .collection<Campaign>(COLLECTIONS.CAMPAIGNS)
    .findOne({ _id: new ObjectId(id) })

  return campaign
}

/**
 * 创建投放计划记录（数据库记录，实际创建需要调用小红书 API）
 */
export async function createCampaignRecord(
  input: CreateCampaignInput & {
    accountId: string
    campaignId: string
    unitId: string
    name: string
  }
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { workId, accountId, campaignId, unitId, name, budget = 2000, bidAmount = 30, targeting = {} } = input

    const db = await getDb()

    const campaign: Omit<Campaign, '_id'> = {
      accountId: new ObjectId(accountId),
      workId: new ObjectId(workId),
      campaignId,
      unitId,
      name,
      objective: 'lead_collection',
      budget,
      bidAmount,
      targeting,
      status: 'active',
      currentBatch: 1,
      batchStartAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.collection(COLLECTIONS.CAMPAIGNS).insertOne(campaign)

    revalidatePath('/campaigns')
    return { success: true, id: result.insertedId.toString() }
  } catch (error) {
    console.error('创建计划记录失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 更新计划状态
 */
export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    }

    // 如果是恢复投放，更新批次信息
    if (status === 'active') {
      updateData.batchStartAt = new Date()
    }

    await db.collection(COLLECTIONS.CAMPAIGNS).updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData, $inc: status === 'active' ? { currentBatch: 1 } : {} }
    )

    revalidatePath('/campaigns')
    revalidatePath(`/campaigns/${id}`)
    return { success: true }
  } catch (error) {
    console.error('更新计划状态失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 获取活跃的投放计划
 */
export async function getActiveCampaigns(accountId?: string): Promise<Campaign[]> {
  const db = await getDb()

  const query: Record<string, unknown> = { status: 'active' }
  if (accountId) query.accountId = new ObjectId(accountId)

  const campaigns = await db
    .collection<Campaign>(COLLECTIONS.CAMPAIGNS)
    .find(query)
    .sort({ createdAt: -1 })
    .toArray()

  return campaigns
}

/**
 * 获取作品的当前投放计划
 */
export async function getWorkActiveCampaign(workId: string): Promise<Campaign | null> {
  const db = await getDb()

  const campaign = await db
    .collection<Campaign>(COLLECTIONS.CAMPAIGNS)
    .findOne({
      workId: new ObjectId(workId),
      status: { $in: ['active', 'pending'] },
    })

  return campaign
}

/**
 * 获取计划的投放记录
 */
export async function getCampaignLogs(campaignId: string) {
  const db = await getDb()

  const logs = await db
    .collection(COLLECTIONS.DELIVERY_LOGS)
    .find({ campaignId: new ObjectId(campaignId) })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()

  return logs
}
