'use server'

import { revalidatePath } from 'next/cache'
import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { encryptCookie, decryptCookie } from '@/lib/utils/crypto'
import { validateCookie } from '@/lib/xhs/auth'
import type { XhsAccount, AccountListItem, CreateAccountInput, AccountThresholds } from '@/types/account'

/**
 * 获取所有账号列表
 */
export async function getAccounts(): Promise<AccountListItem[]> {
  const db = await getDb()
  const accounts = await db
    .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
    .find({})
    .project({ cookie: 0 }) // 不返回敏感信息
    .sort({ createdAt: -1 })
    .toArray()

  return accounts as AccountListItem[]
}

/**
 * 获取单个账号详情
 */
export async function getAccountById(id: string): Promise<AccountListItem | null> {
  const db = await getDb()
  const account = await db
    .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
    .findOne(
      { _id: new ObjectId(id) },
      { projection: { cookie: 0 } }
    )

  return account as AccountListItem | null
}

/**
 * 添加账号
 */
export async function createAccount(input: CreateAccountInput): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { name, cookie, dailyBudget = 5000, defaultBidAmount = 30, thresholds } = input

    // 验证 Cookie 有效性
    const cookieInfo = await validateCookie(cookie)
    if (!cookieInfo.valid) {
      return { success: false, error: 'Cookie 无效或已过期' }
    }

    const db = await getDb()

    // 检查是否已存在（通过 userId 去重）
    if (cookieInfo.userId && cookieInfo.userId !== 'pending') {
      const existing = await db
        .collection(COLLECTIONS.ACCOUNTS)
        .findOne({ userId: cookieInfo.userId })
      if (existing) {
        return { success: false, error: '该账号已存在' }
      }
    }

    // 加密 Cookie
    const encryptedCookie = encryptCookie(cookie)

    const account: Omit<XhsAccount, '_id'> = {
      name,
      userId: cookieInfo.userId || '',
      cookie: encryptedCookie,
      advertiserId: cookieInfo.advertiserId || '',
      balance: cookieInfo.balance || 0,
      autoManaged: false,
      dailyBudget,
      defaultBidAmount,
      thresholds: {
        minConsumption: thresholds?.minConsumption ?? 100,
        maxCostPerLead: thresholds?.maxCostPerLead ?? 50,
        maxFailRetries: thresholds?.maxFailRetries ?? 3,
      },
      status: 'active',
      lastSyncAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.collection(COLLECTIONS.ACCOUNTS).insertOne(account)

    revalidatePath('/accounts')
    return { success: true, id: result.insertedId.toString() }
  } catch (error) {
    console.error('创建账号失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 更新账号 Cookie
 */
export async function updateAccountCookie(
  id: string,
  cookie: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cookieInfo = await validateCookie(cookie)
    if (!cookieInfo.valid) {
      return { success: false, error: 'Cookie 无效或已过期' }
    }

    const db = await getDb()
    const encryptedCookie = encryptCookie(cookie)

    await db.collection(COLLECTIONS.ACCOUNTS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          cookie: encryptedCookie,
          userId: cookieInfo.userId || undefined,
          advertiserId: cookieInfo.advertiserId || undefined,
          balance: cookieInfo.balance || undefined,
          status: 'active',
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        },
      }
    )

    revalidatePath('/accounts')
    revalidatePath(`/accounts/${id}`)
    return { success: true }
  } catch (error) {
    console.error('更新 Cookie 失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 切换自动托管状态
 */
export async function toggleAutoManage(
  id: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    await db.collection(COLLECTIONS.ACCOUNTS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          autoManaged: enabled,
          updatedAt: new Date(),
        },
      }
    )

    // 如果开启托管，创建初始同步任务
    if (enabled) {
      await db.collection(COLLECTIONS.TASKS).insertOne({
        type: 'sync_account',
        accountId: new ObjectId(id),
        status: 'pending',
        priority: 1,
        scheduledAt: new Date(),
        params: {},
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
      })
    }

    revalidatePath('/accounts')
    revalidatePath(`/accounts/${id}`)
    return { success: true }
  } catch (error) {
    console.error('切换自动托管失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 更新账号阈值配置
 */
export async function updateAccountThresholds(
  id: string,
  thresholds: AccountThresholds
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    await db.collection(COLLECTIONS.ACCOUNTS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          thresholds,
          updatedAt: new Date(),
        },
      }
    )

    revalidatePath(`/accounts/${id}/settings`)
    return { success: true }
  } catch (error) {
    console.error('更新阈值失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 更新账号基础信息
 */
export async function updateAccount(
  id: string,
  data: Partial<Pick<XhsAccount, 'name' | 'dailyBudget' | 'defaultBidAmount'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    await db.collection(COLLECTIONS.ACCOUNTS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      }
    )

    revalidatePath('/accounts')
    revalidatePath(`/accounts/${id}`)
    return { success: true }
  } catch (error) {
    console.error('更新账号失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 删除账号（软删除）
 */
export async function deleteAccount(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    await db.collection(COLLECTIONS.ACCOUNTS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'inactive',
          autoManaged: false,
          updatedAt: new Date(),
        },
      }
    )

    revalidatePath('/accounts')
    return { success: true }
  } catch (error) {
    console.error('删除账号失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

/**
 * 获取账号统计数据
 */
export async function getAccountStats(id: string): Promise<{
  totalWorks: number
  activeCampaigns: number
  totalSpent: number
  totalLeads: number
}> {
  const db = await getDb()
  const accountId = new ObjectId(id)

  const [worksCount, campaignsCount, logsAgg] = await Promise.all([
    db.collection(COLLECTIONS.WORKS).countDocuments({ accountId }),
    db.collection(COLLECTIONS.CAMPAIGNS).countDocuments({
      accountId,
      status: 'active',
    }),
    db
      .collection(COLLECTIONS.DELIVERY_LOGS)
      .aggregate([
        { $match: { accountId } },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: '$spent' },
            totalLeads: { $sum: '$leads' },
          },
        },
      ])
      .toArray(),
  ])

  return {
    totalWorks: worksCount,
    activeCampaigns: campaignsCount,
    totalSpent: logsAgg[0]?.totalSpent || 0,
    totalLeads: logsAgg[0]?.totalLeads || 0,
  }
}
