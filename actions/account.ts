'use server'

import { revalidatePath } from 'next/cache'
import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { validateCookie } from '@/lib/xhs/auth'
import { loginWithEmailPassword } from '@/lib/xhs/login'
import type { XhsAccount, AccountListItem, CreateAccountInput, CreateAccountByPasswordInput, AccountThresholds } from '@/types/account'
import type { User } from '@/types/user'
import { getCurrentUserId } from '@/lib/auth/session'
import { deductBalance } from '@/lib/billing/service'

// Cookie 验证结果
export interface VerifyCookieResult {
  success: boolean
  error?: string
  data?: {
    userId: string
    advertiserId: string
    nickname: string
    avatar?: string
    balance: number
  }
}

/**
 * 验证 Cookie 并获取账号信息（用于添加账号前的预览确认）
 */
export async function verifyCookie(cookie: string): Promise<VerifyCookieResult> {
  if (!cookie || cookie.trim().length < 10) {
    return { success: false, error: 'Cookie 不能为空' }
  }

  const cookieInfo = await validateCookie(cookie.trim())

  if (!cookieInfo.valid) {
    return { success: false, error: cookieInfo.errorMessage || 'Cookie 无效或已过期' }
  }

  // 检查是否已存在
  if (cookieInfo.userId) {
    const db = await getDb()
    const existing = await db
      .collection(COLLECTIONS.ACCOUNTS)
      .findOne({ visitorUserId: cookieInfo.userId })
    if (existing) {
      return { success: false, error: '该账号已添加过了' }
    }
  }

  return {
    success: true,
    data: {
      userId: cookieInfo.userId || '',
      advertiserId: cookieInfo.advertiserId || '',
      nickname: cookieInfo.nickname || '未知用户',
      avatar: cookieInfo.avatar,
      balance: cookieInfo.balance || 0,
    }
  }
}

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
 * name 为可选，如果不提供则使用从 Cookie 获取的昵称
 */
export async function createAccount(input: CreateAccountInput): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { name, cookie, dailyBudget = 5000, defaultBidAmount = 30, thresholds } = input

    // 获取当前用户
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) {
      return { success: false, error: '请先登录' }
    }

    const db = await getDb()

    // 获取用户信息检查账号数量限制
    const user = await db.collection<User>(COLLECTIONS.USERS).findOne({
      _id: new ObjectId(currentUserId)
    })

    if (!user) {
      return { success: false, error: '用户不存在' }
    }

    // 检查是否超出免费额度
    if (user.currentAccounts >= user.maxAccounts) {
      // 需要扣费
      const deductResult = await deductBalance(currentUserId, 'account_add', {
        relatedType: 'account',
        description: '添加账号(超额)',
      })

      if (!deductResult.success) {
        return {
          success: false,
          error: `账号数量已达上限(${user.maxAccounts}个)，${deductResult.error}`
        }
      }
    }

    // 验证 Cookie 有效性
    const cookieInfo = await validateCookie(cookie)
    if (!cookieInfo.valid) {
      return { success: false, error: cookieInfo.errorMessage || 'Cookie 无效或已过期' }
    }

    // 检查是否已存在（通过 userId 去重）
    if (cookieInfo.userId) {
      const existing = await db
        .collection(COLLECTIONS.ACCOUNTS)
        .findOne({ visitorUserId: cookieInfo.userId })
      if (existing) {
        return { success: false, error: '该账号已存在' }
      }
    }

    // 使用提供的名称，或者从 Cookie 获取的昵称
    const accountName = name?.trim() || cookieInfo.nickname || '未命名账号'

    const account: Omit<XhsAccount, '_id'> = {
      userId: new ObjectId(currentUserId),  // 关联当前用户
      name: accountName,
      visitorUserId: cookieInfo.userId || '',
      cookie: cookie,
      loginType: 'cookie',
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

    // 更新用户账号计数
    await db.collection<User>(COLLECTIONS.USERS).updateOne(
      { _id: new ObjectId(currentUserId) },
      {
        $inc: { currentAccounts: 1 },
        $set: { updatedAt: new Date() },
      }
    )

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

    await db.collection(COLLECTIONS.ACCOUNTS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          cookie: cookie,  // 直接存储，不加密
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
 * 使用账号密码更新登录凭证
 */
export async function updateAccountByPassword(
  id: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 登录获取新的 cookie
    const loginResult = await loginWithEmailPassword(email, password)

    if (!loginResult.success || !loginResult.cookie) {
      return { success: false, error: loginResult.error || '登录失败' }
    }

    // 验证 Cookie 有效性
    const cookieInfo = await validateCookie(loginResult.cookie)
    if (!cookieInfo.valid) {
      return { success: false, error: cookieInfo.errorMessage || '登录验证失败' }
    }

    const db = await getDb()

    await db.collection(COLLECTIONS.ACCOUNTS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          cookie: loginResult.cookie,
          loginType: 'password',
          loginEmail: email,
          visitorUserId: cookieInfo.userId || undefined,
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
    console.error('使用账号密码更新登录凭证失败:', error)
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

// 账号密码登录验证结果
export interface VerifyPasswordLoginResult {
  success: boolean
  error?: string
  data?: {
    userId: string
    advertiserId: string
    nickname: string
    avatar?: string
    balance: number
    cookie: string
  }
}

/**
 * 使用账号密码登录并验证
 */
export async function verifyPasswordLogin(
  email: string,
  password: string
): Promise<VerifyPasswordLoginResult> {
  if (!email || !password) {
    return { success: false, error: '请填写邮箱和密码' }
  }

  // 登录获取 cookie
  const loginResult = await loginWithEmailPassword(email, password)

  if (!loginResult.success || !loginResult.cookie) {
    return { success: false, error: loginResult.error || '登录失败' }
  }

  // 使用获取的 cookie 验证并获取账号信息
  const cookieInfo = await validateCookie(loginResult.cookie)

  if (!cookieInfo.valid) {
    return { success: false, error: cookieInfo.errorMessage || '登录验证失败' }
  }

  // 检查是否已存在
  if (cookieInfo.userId) {
    const db = await getDb()
    const existing = await db
      .collection(COLLECTIONS.ACCOUNTS)
      .findOne({ visitorUserId: cookieInfo.userId })
    if (existing) {
      return { success: false, error: '该账号已添加过了' }
    }
  }

  return {
    success: true,
    data: {
      userId: cookieInfo.userId || loginResult.userId || '',
      advertiserId: cookieInfo.advertiserId || loginResult.advertiserId || '',
      nickname: cookieInfo.nickname || '未知用户',
      avatar: cookieInfo.avatar,
      balance: cookieInfo.balance || 0,
      cookie: loginResult.cookie,
    }
  }
}

/**
 * 使用账号密码方式添加账号
 */
export async function createAccountByPassword(
  input: CreateAccountByPasswordInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { email, password, dailyBudget = 5000, defaultBidAmount = 30, thresholds } = input

    // 获取当前用户
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) {
      return { success: false, error: '请先登录' }
    }

    const db = await getDb()

    // 获取用户信息检查账号数量限制
    const user = await db.collection<User>(COLLECTIONS.USERS).findOne({
      _id: new ObjectId(currentUserId)
    })

    if (!user) {
      return { success: false, error: '用户不存在' }
    }

    // 检查是否超出免费额度
    if (user.currentAccounts >= user.maxAccounts) {
      const deductResult = await deductBalance(currentUserId, 'account_add', {
        relatedType: 'account',
        description: '添加账号(超额)',
      })

      if (!deductResult.success) {
        return {
          success: false,
          error: `账号数量已达上限(${user.maxAccounts}个)，${deductResult.error}`
        }
      }
    }

    // 登录并验证
    const loginResult = await loginWithEmailPassword(email, password)

    if (!loginResult.success || !loginResult.cookie) {
      return { success: false, error: loginResult.error || '登录失败' }
    }

    // 验证 Cookie 有效性
    const cookieInfo = await validateCookie(loginResult.cookie)
    if (!cookieInfo.valid) {
      return { success: false, error: cookieInfo.errorMessage || '登录验证失败' }
    }

    // 检查是否已存在
    if (cookieInfo.userId) {
      const existing = await db
        .collection(COLLECTIONS.ACCOUNTS)
        .findOne({ visitorUserId: cookieInfo.userId })
      if (existing) {
        return { success: false, error: '该账号已存在' }
      }
    }

    const accountName = cookieInfo.nickname || '未命名账号'

    const account: Omit<XhsAccount, '_id'> = {
      userId: new ObjectId(currentUserId),
      name: accountName,
      visitorUserId: cookieInfo.userId || '',
      cookie: loginResult.cookie,
      loginType: 'password',
      loginEmail: email,
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

    // 更新用户账号计数
    await db.collection<User>(COLLECTIONS.USERS).updateOne(
      { _id: new ObjectId(currentUserId) },
      {
        $inc: { currentAccounts: 1 },
        $set: { updatedAt: new Date() },
      }
    )

    revalidatePath('/accounts')
    return { success: true, id: result.insertedId.toString() }
  } catch (error) {
    console.error('账号密码方式创建账号失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}
