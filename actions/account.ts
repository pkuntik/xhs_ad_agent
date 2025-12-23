'use server'

import { revalidatePath } from 'next/cache'
import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { validateCookie } from '@/lib/xhs/auth'
import { loginWithEmailPassword, getQRCodeLogin, checkQRCodeStatus } from '@/lib/xhs/login'
import { queryChipsNotes, queryChipsOrders, getChipsWalletBalance } from '@/lib/xhs/api/chips'
import type { XhsAccount, AccountListItem, CreateAccountInput, CreateAccountByPasswordInput, AccountThresholds } from '@/types/account'
import type { RemoteNote, RemoteNoteItem } from '@/types/remote-note'
import type { Order, OrderListItem, ChipsOrderItem } from '@/types/order'
import type { User } from '@/types/user'
import { getCurrentUserId } from '@/lib/auth/session'
import { deductBalance } from '@/lib/billing/service'
import { AppError, ERROR_CODES, handleActionError, logError } from '@/lib/utils/error-handling'

import type { AccountStatusDetail } from '@/types/account'

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
    // 新增详细信息
    subAccount?: boolean
    roleType?: number
    permissionsCount?: number
    hasChipsPermission?: boolean
    accountStatus?: AccountStatusDetail
    hasAbnormalIssues?: boolean
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
      subAccount: cookieInfo.subAccount,
      roleType: cookieInfo.roleType,
      permissionsCount: cookieInfo.permissionsCount,
      hasChipsPermission: cookieInfo.hasChipsPermission,
      accountStatus: cookieInfo.accountStatus,
      hasAbnormalIssues: cookieInfo.hasAbnormalIssues,
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
    .sort({ isPinned: -1, createdAt: -1 }) // 置顶账号优先，然后按创建时间倒序
    .toArray()

  // 序列化 ObjectId 和 Date 为客户端可用格式
  return accounts.map(account => ({
    ...account,
    _id: account._id.toString(),
    userId: account.userId?.toString(),
  })) as AccountListItem[]
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

  if (!account) return null

  // 序列化 ObjectId 为客户端可用格式
  return {
    ...account,
    _id: account._id.toString(),
    userId: account.userId?.toString(),
  } as AccountListItem
}

// ============================================
// 账号创建辅助函数
// ============================================

/**
 * 检查用户登录状态和配额
 */
async function checkUserQuota(): Promise<{
  success: false; error: string
} | {
  success: true; userId: string; user: User; db: Awaited<ReturnType<typeof getDb>>
}> {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) {
    return { success: false, error: ERROR_CODES.AUTH_NOT_LOGGED_IN }
  }

  const db = await getDb()
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

  return { success: true, userId: currentUserId, user, db }
}

/**
 * 验证 Cookie 并检查账号是否已存在
 */
async function validateCookieAndCheckDuplicate(
  cookie: string,
  db: Awaited<ReturnType<typeof getDb>>,
  errorPrefix = 'Cookie 无效或已过期'
): Promise<{
  success: false; error: string
} | {
  success: true; cookieInfo: Awaited<ReturnType<typeof validateCookie>>
}> {
  const cookieInfo = await validateCookie(cookie)
  if (!cookieInfo.valid) {
    return { success: false, error: cookieInfo.errorMessage || errorPrefix }
  }

  if (cookieInfo.userId) {
    const existing = await db
      .collection(COLLECTIONS.ACCOUNTS)
      .findOne({ visitorUserId: cookieInfo.userId })
    if (existing) {
      return { success: false, error: '该账号已存在' }
    }
  }

  return { success: true, cookieInfo }
}

/**
 * 添加账号
 * name 为可选，如果不提供则使用从 Cookie 获取的昵称
 */
export async function createAccount(input: CreateAccountInput): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { name, cookie, dailyBudget = 5000, defaultBidAmount = 30, thresholds } = input

    // 检查用户登录和配额
    const quotaCheck = await checkUserQuota()
    if (!quotaCheck.success) {
      return { success: false, error: quotaCheck.error }
    }
    const { userId: currentUserId, db } = quotaCheck

    // 验证 Cookie 并检查重复
    const cookieCheck = await validateCookieAndCheckDuplicate(cookie, db)
    if (!cookieCheck.success) {
      return { success: false, error: cookieCheck.error }
    }
    const { cookieInfo } = cookieCheck

    // 使用提供的名称，或者从 Cookie 获取的昵称
    const accountName = name?.trim() || cookieInfo.nickname || '未命名账号'

    const account: Omit<XhsAccount, '_id'> = {
      userId: new ObjectId(currentUserId),  // 关联当前用户
      name: accountName,
      visitorUserId: cookieInfo.userId || '',
      cookie: cookie,
      nickname: cookieInfo.nickname,
      avatar: cookieInfo.avatar,
      loginType: 'cookie',
      advertiserId: cookieInfo.advertiserId || '',
      sellerId: cookieInfo.sellerId,
      balance: cookieInfo.balance || 0,
      subAccount: cookieInfo.subAccount,
      roleType: cookieInfo.roleType,
      permissionsCount: cookieInfo.permissionsCount,
      accountStatusDetail: cookieInfo.accountStatus,
      hasAbnormalIssues: cookieInfo.hasAbnormalIssues,
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
    logError(error, '创建账号')
    return handleActionError(error)
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
          cookie: cookie,
          visitorUserId: cookieInfo.userId || undefined,
          nickname: cookieInfo.nickname,
          avatar: cookieInfo.avatar,
          advertiserId: cookieInfo.advertiserId || undefined,
          sellerId: cookieInfo.sellerId,
          balance: cookieInfo.balance || undefined,
          subAccount: cookieInfo.subAccount,
          roleType: cookieInfo.roleType,
          permissionsCount: cookieInfo.permissionsCount,
          accountStatusDetail: cookieInfo.accountStatus,
          hasAbnormalIssues: cookieInfo.hasAbnormalIssues,
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
    logError(error, '更新 Cookie')
    return handleActionError(error)
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
          loginPassword: password,
          visitorUserId: cookieInfo.userId || undefined,
          nickname: cookieInfo.nickname,
          avatar: cookieInfo.avatar,
          advertiserId: cookieInfo.advertiserId || undefined,
          sellerId: cookieInfo.sellerId,
          balance: cookieInfo.balance || undefined,
          subAccount: cookieInfo.subAccount,
          roleType: cookieInfo.roleType,
          permissionsCount: cookieInfo.permissionsCount,
          accountStatusDetail: cookieInfo.accountStatus,
          hasAbnormalIssues: cookieInfo.hasAbnormalIssues,
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
    logError(error, '使用账号密码更新登录凭证')
    return handleActionError(error)
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
    logError(error, '切换自动托管')
    return handleActionError(error)
  }
}

/**
 * 切换账号置顶状态
 */
export async function toggleAccountPin(
  id: string,
  pinned: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb()

    await db.collection(COLLECTIONS.ACCOUNTS).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isPinned: pinned,
          updatedAt: new Date(),
        },
      }
    )

    revalidatePath('/accounts')
    return { success: true }
  } catch (error) {
    logError(error, '切换置顶状态')
    return handleActionError(error)
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
    logError(error, '更新阈值')
    return handleActionError(error)
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
    logError(error, '更新账号')
    return handleActionError(error)
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
    logError(error, '删除账号')
    return handleActionError(error)
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
    db.collection(COLLECTIONS.REMOTE_NOTES).countDocuments({ accountId }),
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

    // 检查用户登录和配额
    const quotaCheck = await checkUserQuota()
    if (!quotaCheck.success) {
      return { success: false, error: quotaCheck.error }
    }
    const { userId: currentUserId, db } = quotaCheck

    // 登录并验证
    const loginResult = await loginWithEmailPassword(email, password)
    if (!loginResult.success || !loginResult.cookie) {
      return { success: false, error: loginResult.error || '登录失败' }
    }

    // 验证 Cookie 并检查重复
    const cookieCheck = await validateCookieAndCheckDuplicate(loginResult.cookie, db, '登录验证失败')
    if (!cookieCheck.success) {
      return { success: false, error: cookieCheck.error }
    }
    const { cookieInfo } = cookieCheck

    const accountName = cookieInfo.nickname || '未命名账号'

    const account: Omit<XhsAccount, '_id'> = {
      userId: new ObjectId(currentUserId),
      name: accountName,
      visitorUserId: cookieInfo.userId || '',
      cookie: loginResult.cookie,
      nickname: cookieInfo.nickname,
      avatar: cookieInfo.avatar,
      loginType: 'password',
      loginEmail: email,
      loginPassword: password,
      advertiserId: cookieInfo.advertiserId || '',
      sellerId: cookieInfo.sellerId,
      balance: cookieInfo.balance || 0,
      subAccount: cookieInfo.subAccount,
      roleType: cookieInfo.roleType,
      permissionsCount: cookieInfo.permissionsCount,
      accountStatusDetail: cookieInfo.accountStatus,
      hasAbnormalIssues: cookieInfo.hasAbnormalIssues,
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
    logError(error, '账号密码方式创建账号')
    return handleActionError(error)
  }
}

// 同步账号信息结果
export interface SyncAccountInfoResult {
  success: boolean
  error?: string
  data?: {
    balance: number
    redcoin?: number
    nickname?: string
    hasAbnormalIssues?: boolean
  }
}

/**
 * 同步账号信息（从聚光平台刷新余额、状态等）
 */
export async function syncAccountInfo(accountId: string): Promise<SyncAccountInfoResult> {
  try {
    const db = await getDb()

    // 获取账号信息（包含 cookie）
    const account = await db
      .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
      .findOne({ _id: new ObjectId(accountId) })

    if (!account) {
      return { success: false, error: '账号不存在' }
    }

    if (!account.cookie) {
      return { success: false, error: '账号未配置登录凭证' }
    }

    // 验证并获取最新账号信息
    const cookieInfo = await validateCookie(account.cookie)

    if (!cookieInfo.valid) {
      // Cookie 已过期，更新状态
      await db.collection(COLLECTIONS.ACCOUNTS).updateOne(
        { _id: new ObjectId(accountId) },
        {
          $set: {
            status: 'cookie_expired',
            updatedAt: new Date(),
          },
        }
      )
      return { success: false, error: cookieInfo.errorMessage || 'Cookie 已过期' }
    }

    // 获取薯币余额（仅有薯条权限时）
    let redcoin = 0
    if (cookieInfo.hasChipsPermission) {
      try {
        const walletInfo = await getChipsWalletBalance(account.cookie)
        redcoin = walletInfo.redcoin
      } catch (e) {
        console.warn('获取薯币余额失败:', e)
      }
    }

    // 更新账号信息
    const now = new Date()
    await db.collection(COLLECTIONS.ACCOUNTS).updateOne(
      { _id: new ObjectId(accountId) },
      {
        $set: {
          nickname: cookieInfo.nickname,
          avatar: cookieInfo.avatar,
          balance: cookieInfo.balance || 0,
          redcoin,
          subAccount: cookieInfo.subAccount,
          roleType: cookieInfo.roleType,
          permissionsCount: cookieInfo.permissionsCount,
          hasChipsPermission: cookieInfo.hasChipsPermission,
          accountStatusDetail: cookieInfo.accountStatus,
          hasAbnormalIssues: cookieInfo.hasAbnormalIssues,
          status: 'active',
          lastSyncAt: now,
          updatedAt: now,
        },
      }
    )

    revalidatePath('/accounts')
    revalidatePath(`/accounts/${accountId}`)

    return {
      success: true,
      data: {
        balance: cookieInfo.balance || 0,
        redcoin,
        nickname: cookieInfo.nickname,
        hasAbnormalIssues: cookieInfo.hasAbnormalIssues,
      },
    }
  } catch (error) {
    logError(error, '同步账号信息')
    const result = handleActionError(error)
    return { success: false, error: result.error }
  }
}

// 同步笔记结果
export interface SyncNotesResult {
  success: boolean
  error?: string
  data?: {
    synced: number      // 同步的笔记数量
    updated: number     // 更新的笔记数量
    total: number       // 总笔记数量
  }
}

// ============================================
// syncRemoteNotes 辅助函数
// ============================================

/**
 * 验证账号是否可以同步
 * 如果验证失败会抛出 AppError
 */
async function validateAccountForSync(accountId: string): Promise<XhsAccount> {
  const db = await getDb()

  const account = await db
    .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
    .findOne({ _id: new ObjectId(accountId) })

  if (!account) {
    throw new AppError(ERROR_CODES.ACCOUNT_NOT_FOUND)
  }

  if (!account.cookie) {
    throw new AppError(ERROR_CODES.ACCOUNT_NO_COOKIE)
  }

  if (account.status === 'cookie_expired') {
    throw new AppError(ERROR_CODES.AUTH_COOKIE_EXPIRED)
  }

  return account
}

/**
 * 并发控制函数：限制同时执行的 Promise 数量
 */
async function pLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = []
  const executing: Promise<void>[] = []

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task()).then(result => {
      results.push(result)
    })
    executing.push(p as Promise<void>)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
      executing.splice(0, executing.findIndex(e => e === p) + 1)
    }
  }

  await Promise.all(executing)
  return results
}

/**
 * 转换远程笔记为数据库格式
 */
function convertNoteToDBFormat(
  note: { note_id: string; note_title?: string; note_image?: string; note_type: number; author_name?: string; create_time: number; read?: number; likes?: number; comments?: number; favorite?: number; can_heat: boolean; cant_heat_desc?: string; xsec_token?: string },
  accountObjId: ObjectId,
  now: Date
): RemoteNote {
  return {
    _id: new ObjectId(),
    accountId: accountObjId,
    noteId: note.note_id,
    title: note.note_title || '',
    coverImage: note.note_image || '',
    noteType: note.note_type,
    authorName: note.author_name || '',
    publishedAt: new Date(note.create_time),
    reads: note.read || 0,
    likes: note.likes || 0,
    comments: note.comments || 0,
    favorites: note.favorite || 0,
    canHeat: note.can_heat,
    cantHeatDesc: note.cant_heat_desc,
    xsecToken: note.xsec_token || '',
    syncedAt: now,
    createdAt: now,
  }
}

/**
 * 从远程获取所有笔记（并发优化版）
 */
async function fetchAllRemoteNotes(
  cookie: string,
  accountObjId: ObjectId,
  now: Date
): Promise<RemoteNote[]> {
  const pageSize = 20
  const concurrency = 3

  // 首先获取第一页，得到总数
  const firstResult = await queryChipsNotes(cookie, { page: 1, pageSize })

  if (firstResult.list.length === 0) {
    return []
  }

  const allNotes: RemoteNote[] = firstResult.list.map(note =>
    convertNoteToDBFormat(note, accountObjId, now)
  )

  const totalPages = Math.ceil(firstResult.total / pageSize)

  if (totalPages <= 1) {
    return allNotes
  }

  // 并发获取剩余页面
  const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
  const tasks = remainingPages.map(page =>
    () => queryChipsNotes(cookie, { page, pageSize })
  )

  const results = await pLimit(tasks, concurrency)

  for (const result of results) {
    for (const note of result.list) {
      allNotes.push(convertNoteToDBFormat(note, accountObjId, now))
    }
  }

  return allNotes
}

/**
 * 批量更新或插入笔记到数据库（优化版：批量查询）
 */
async function upsertNotesToDB(
  notes: RemoteNote[],
  accountObjId: ObjectId,
  now: Date
): Promise<{ inserted: number; updated: number }> {
  if (notes.length === 0) {
    return { inserted: 0, updated: 0 }
  }

  const db = await getDb()
  const remoteNotesCollection = db.collection<RemoteNote>(COLLECTIONS.REMOTE_NOTES)

  // 批量查询已存在的笔记
  const noteIds = notes.map(n => n.noteId)
  const existingNotes = await remoteNotesCollection
    .find({
      accountId: accountObjId,
      noteId: { $in: noteIds }
    })
    .toArray()

  const existingMap = new Map(existingNotes.map(n => [n.noteId, n]))

  let updated = 0
  let inserted = 0

  // 准备批量操作
  const bulkOps: Array<
    | { updateOne: { filter: { _id: ObjectId }; update: { $set: Record<string, unknown> } } }
    | { insertOne: { document: RemoteNote } }
  > = []

  for (const note of notes) {
    const existing = existingMap.get(note.noteId)

    if (existing) {
      bulkOps.push({
        updateOne: {
          filter: { _id: existing._id },
          update: {
            $set: {
              title: note.title,
              coverImage: note.coverImage,
              reads: note.reads,
              likes: note.likes,
              comments: note.comments,
              favorites: note.favorites,
              canHeat: note.canHeat,
              cantHeatDesc: note.cantHeatDesc,
              xsecToken: note.xsecToken,
              syncedAt: now,
            },
          },
        },
      })
      updated++
    } else {
      bulkOps.push({
        insertOne: {
          document: note,
        },
      })
      inserted++
    }
  }

  if (bulkOps.length > 0) {
    await remoteNotesCollection.bulkWrite(bulkOps)
  }

  return { inserted, updated }
}

/**
 * 更新账号的最后同步时间
 */
async function updateAccountSyncTime(accountId: string, now: Date): Promise<void> {
  const db = await getDb()
  await db.collection(COLLECTIONS.ACCOUNTS).updateOne(
    { _id: new ObjectId(accountId) },
    { $set: { lastSyncAt: now, updatedAt: now } }
  )
}

// ============================================
// 主函数
// ============================================

/**
 * 同步账号的所有笔记（从聚光平台获取并保存到数据库）
 */
export async function syncRemoteNotes(accountId: string): Promise<SyncNotesResult> {
  try {
    const account = await validateAccountForSync(accountId)
    const accountObjId = new ObjectId(accountId)
    const now = new Date()

    const allNotes = await fetchAllRemoteNotes(account.cookie!, accountObjId, now)
    const { inserted, updated } = await upsertNotesToDB(allNotes, accountObjId, now)

    await updateAccountSyncTime(accountId, now)
    revalidatePath(`/accounts/${accountId}`)

    return {
      success: true,
      data: {
        synced: inserted,
        updated,
        total: allNotes.length,
      },
    }
  } catch (error) {
    logError(error, '同步远程笔记')
    const result = handleActionError(error)
    return { success: false, error: result.error }
  }
}

// 获取已同步笔记列表结果
export interface GetSyncedNotesResult {
  success: boolean
  error?: string
  data?: {
    list: RemoteNoteItem[]
    total: number
    lastSyncAt?: Date
  }
}

/**
 * 获取账号已同步的笔记列表（从数据库）
 */
export async function getSyncedNotes(
  accountId: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<GetSyncedNotesResult> {
  try {
    const { page = 1, pageSize = 10 } = options
    const db = await getDb()
    const accountObjId = new ObjectId(accountId)

    // 获取账号信息（检查最后同步时间）
    const account = await db
      .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
      .findOne(
        { _id: accountObjId },
        { projection: { lastSyncAt: 1 } }
      )

    // 查询笔记列表
    const [notes, total] = await Promise.all([
      db
        .collection<RemoteNote>(COLLECTIONS.REMOTE_NOTES)
        .find({ accountId: accountObjId })
        .sort({ publishedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      db
        .collection<RemoteNote>(COLLECTIONS.REMOTE_NOTES)
        .countDocuments({ accountId: accountObjId }),
    ])

    // 序列化为客户端格式
    const list: RemoteNoteItem[] = notes.map(note => ({
      ...note,
      _id: note._id.toString(),
      accountId: note.accountId.toString(),
    }))

    return {
      success: true,
      data: {
        list,
        total,
        lastSyncAt: account?.lastSyncAt,
      },
    }
  } catch (error) {
    logError(error, '获取已同步笔记')
    const result = handleActionError(error)
    return { success: false, error: result.error }
  }
}

// 同步订单结果
export interface SyncOrdersResult {
  success: boolean
  error?: string
  data?: {
    synced: number      // 新增的订单数量
    updated: number     // 更新的订单数量
    total: number       // 总订单数量
  }
}

// ============================================
// syncOrders 辅助函数
// ============================================

/**
 * 从远程获取所有订单（并发优化版）
 */
async function fetchAllRemoteOrders(cookie: string): Promise<ChipsOrderItem[]> {
  const pageSize = 20
  const concurrency = 3

  // 首先获取第一页，得到总数
  const firstResult = await queryChipsOrders(cookie, { page: 1, page_size: pageSize })

  if (firstResult.list.length === 0) {
    return []
  }

  const allOrders: ChipsOrderItem[] = [...firstResult.list]
  const totalPages = Math.ceil(firstResult.total / pageSize)

  if (totalPages <= 1) {
    return allOrders
  }

  // 并发获取剩余页面
  const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
  const tasks = remainingPages.map(page =>
    () => queryChipsOrders(cookie, { page, page_size: pageSize })
  )

  const results = await pLimit(tasks, concurrency)

  for (const result of results) {
    allOrders.push(...result.list)
  }

  return allOrders
}

/**
 * 将远程订单转换为数据库格式
 */
function convertOrderToDBFormat(
  order: ChipsOrderItem,
  accountObjId: ObjectId,
  now: Date
): Omit<Order, '_id'> {
  return {
    accountId: accountObjId,
    orderNo: order.order_no,
    state: order.state,
    stateDesc: order.state_desc,
    createTime: new Date(order.create_time),
    planStartTime: new Date(order.plan_start_time),
    endTime: new Date(order.end_time),
    totalTime: order.total_time,
    campaignBudget: order.campaign_budget,
    actualPay: order.actual_pay,
    actualRefund: order.actual_refund,
    consume: order.consume || 0,
    totalDiscount: order.total_discount,
    impression: order.impression || 0,
    read: order.read || 0,
    likes: order.likes || 0,
    comments: order.comments || 0,
    favorite: order.favorite || 0,
    follow: order.follow || 0,
    homepageView: order.homepage_view || 0,
    cpa: order.cpa || 0,
    convCntMin: order.conv_cnt_min,
    convCntMax: order.conv_cnt_max,
    advertiseTarget: order.advertise_target,
    advertiseTargetDesc: order.advertise_target_desc,
    smartTarget: order.smart_target,
    giftMode: order.gift_mode,
    multiNote: order.multi_note,
    targetInfo: order.target_info,
    notes: order.notes,
    canHeat: order.can_heat,
    cantHeatDesc: order.cant_heat_desc,
    payChannel: order.pay_channel,
    payChannelDesc: order.pay_channel_desc,
    discountMode: order.discount_mode,
    discountInfo: order.discount_info,
    syncedAt: now,
    updatedAt: now,
  }
}

/**
 * 批量更新或插入订单到数据库（优化版：批量查询）
 */
async function upsertOrdersToDB(
  orders: ChipsOrderItem[],
  accountObjId: ObjectId,
  now: Date
): Promise<{ inserted: number; updated: number }> {
  if (orders.length === 0) {
    return { inserted: 0, updated: 0 }
  }

  const db = await getDb()
  const ordersCollection = db.collection<Order>(COLLECTIONS.ORDERS)

  // 批量查询已存在的订单
  const orderNos = orders.map(o => o.order_no)
  const existingOrders = await ordersCollection
    .find({
      accountId: accountObjId,
      orderNo: { $in: orderNos }
    })
    .toArray()

  const existingMap = new Map(existingOrders.map(o => [o.orderNo, o]))

  let updated = 0
  let inserted = 0

  // 准备批量操作
  const bulkOps: Array<
    | { updateOne: { filter: { _id: ObjectId }; update: { $set: Omit<Order, '_id'> } } }
    | { insertOne: { document: Order } }
  > = []

  for (const order of orders) {
    const existing = existingMap.get(order.order_no)
    const orderDoc = convertOrderToDBFormat(order, accountObjId, now)

    if (existing) {
      bulkOps.push({
        updateOne: {
          filter: { _id: existing._id },
          update: { $set: orderDoc }
        }
      })
      updated++
    } else {
      bulkOps.push({
        insertOne: {
          document: {
            _id: new ObjectId(),
            ...orderDoc,
          } as Order
        }
      })
      inserted++
    }
  }

  if (bulkOps.length > 0) {
    await ordersCollection.bulkWrite(bulkOps)
  }

  return { inserted, updated }
}

// ============================================
// 主函数
// ============================================

/**
 * 同步账号的所有订单（从聚光平台获取并保存到数据库）
 */
export async function syncOrders(accountId: string): Promise<SyncOrdersResult> {
  try {
    const account = await validateAccountForSync(accountId)
    const accountObjId = new ObjectId(accountId)
    const now = new Date()

    const allOrders = await fetchAllRemoteOrders(account.cookie!)
    const { inserted, updated } = await upsertOrdersToDB(allOrders, accountObjId, now)

    revalidatePath(`/accounts/${accountId}`)

    return {
      success: true,
      data: {
        synced: inserted,
        updated,
        total: allOrders.length,
      },
    }
  } catch (error) {
    logError(error, '同步订单')
    const result = handleActionError(error)
    return { success: false, error: result.error }
  }
}

// 获取已同步订单列表结果
export interface GetSyncedOrdersResult {
  success: boolean
  error?: string
  data?: {
    list: OrderListItem[]
    total: number
  }
}

/**
 * 获取账号已同步的订单列表（从数据库）
 */
export async function getSyncedOrders(
  accountId: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<GetSyncedOrdersResult> {
  try {
    const { page = 1, pageSize = 10 } = options
    const db = await getDb()
    const accountObjId = new ObjectId(accountId)

    // 查询订单列表
    const [orders, total] = await Promise.all([
      db
        .collection<Order>(COLLECTIONS.ORDERS)
        .find({ accountId: accountObjId })
        .sort({ createTime: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      db
        .collection<Order>(COLLECTIONS.ORDERS)
        .countDocuments({ accountId: accountObjId }),
    ])

    // 序列化为客户端格式（金额转为元）
    const list: OrderListItem[] = orders.map(order => ({
      _id: order._id.toString(),
      orderNo: order.orderNo,
      state: order.state,
      stateDesc: order.stateDesc,
      createTime: order.createTime.toISOString(),
      planStartTime: order.planStartTime.toISOString(),
      endTime: order.endTime.toISOString(),
      campaignBudget: order.campaignBudget / 100,
      actualPay: order.actualPay / 100,
      actualRefund: order.actualRefund / 100,
      consume: order.consume / 100,
      impression: order.impression,
      read: order.read,
      likes: order.likes,
      comments: order.comments,
      favorite: order.favorite,
      follow: order.follow,
      homepageView: order.homepageView,
      cpa: order.cpa / 100,
      advertiseTargetDesc: order.advertiseTargetDesc,
      notes: order.notes,
      canHeat: order.canHeat,
      cantHeatDesc: order.cantHeatDesc,
    }))

    return {
      success: true,
      data: {
        list,
        total,
      },
    }
  } catch (error) {
    logError(error, '获取已同步订单')
    const result = handleActionError(error)
    return { success: false, error: result.error }
  }
}

// ============ 扫码登录相关 ============

// 获取二维码结果
export interface GetQRCodeResult {
  success: boolean
  error?: string
  qrCodeUrl?: string
  qrCodeId?: string
}

/**
 * 获取扫码登录二维码
 */
export async function getLoginQRCode(): Promise<GetQRCodeResult> {
  try {
    const result = await getQRCodeLogin()

    if (!result.success) {
      return { success: false, error: result.error || '获取二维码失败' }
    }

    return {
      success: true,
      qrCodeUrl: result.qrCodeUrl,
      qrCodeId: result.qrCodeId,
    }
  } catch (error) {
    logError(error, '获取登录二维码')
    const result = handleActionError(error)
    return { success: false, error: result.error }
  }
}

// 检查二维码状态结果
export interface CheckQRCodeResult {
  success: boolean
  error?: string
  status: 'waiting' | 'scanned' | 'confirmed' | 'expired'
  cookie?: string
}

/**
 * 检查二维码扫描状态
 */
export async function checkLoginQRCodeStatus(qrCodeId: string): Promise<CheckQRCodeResult> {
  try {
    const result = await checkQRCodeStatus(qrCodeId)

    if (!result.success) {
      return {
        success: false,
        error: result.error || '检查状态失败',
        status: result.status,
      }
    }

    if (result.status === 'confirmed' && result.loginResult?.cookie) {
      return {
        success: true,
        status: 'confirmed',
        cookie: result.loginResult.cookie,
      }
    }

    return {
      success: true,
      status: result.status,
    }
  } catch (error) {
    logError(error, '检查二维码状态')
    return {
      success: false,
      error: error instanceof Error ? error.message : '检查状态失败',
      status: 'expired',
    }
  }
}

/**
 * 通过扫码方式创建账号
 */
export async function createAccountByQRCode(
  cookie: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    // 检查用户登录和配额
    const quotaCheck = await checkUserQuota()
    if (!quotaCheck.success) {
      return { success: false, error: quotaCheck.error }
    }
    const { userId: currentUserId, db } = quotaCheck

    // 验证 Cookie 并检查重复
    const cookieCheck = await validateCookieAndCheckDuplicate(cookie, db, '登录验证失败')
    if (!cookieCheck.success) {
      return { success: false, error: cookieCheck.error }
    }
    const { cookieInfo } = cookieCheck

    const accountName = cookieInfo.nickname || '未命名账号'

    const account: Omit<XhsAccount, '_id'> = {
      userId: new ObjectId(currentUserId),
      name: accountName,
      visitorUserId: cookieInfo.userId || '',
      cookie: cookie,
      nickname: cookieInfo.nickname,
      avatar: cookieInfo.avatar,
      loginType: 'qrcode',
      advertiserId: cookieInfo.advertiserId || '',
      sellerId: cookieInfo.sellerId,
      balance: cookieInfo.balance || 0,
      subAccount: cookieInfo.subAccount,
      roleType: cookieInfo.roleType,
      permissionsCount: cookieInfo.permissionsCount,
      hasChipsPermission: cookieInfo.hasChipsPermission,
      accountStatusDetail: cookieInfo.accountStatus,
      hasAbnormalIssues: cookieInfo.hasAbnormalIssues,
      autoManaged: false,
      dailyBudget: 5000,
      defaultBidAmount: 30,
      thresholds: {
        minConsumption: 100,
        maxCostPerLead: 50,
        maxFailRetries: 3,
      },
      status: 'active',
      lastSyncAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db
      .collection<XhsAccount>(COLLECTIONS.ACCOUNTS)
      .insertOne(account as XhsAccount)

    // 更新用户账号数量
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
    logError(error, '扫码方式创建账号')
    return handleActionError(error)
  }
}
