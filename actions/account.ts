'use server'

import { revalidatePath } from 'next/cache'
import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { validateCookie } from '@/lib/xhs/auth'
import { loginWithEmailPassword } from '@/lib/xhs/login'
import { queryChipsNotes, type ChipsNoteItem, type QueryNotesParams } from '@/lib/xhs/api/chips'
import type { XhsAccount, AccountListItem, CreateAccountInput, CreateAccountByPasswordInput, AccountThresholds } from '@/types/account'
import type { RemoteNote, RemoteNoteItem } from '@/types/remote-note'
import type { User } from '@/types/user'
import { getCurrentUserId } from '@/lib/auth/session'
import { deductBalance } from '@/lib/billing/service'

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
    console.error('切换置顶状态失败:', error)
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
    console.error('账号密码方式创建账号失败:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误' }
  }
}

// 同步结果
export interface SyncNotesResult {
  success: boolean
  error?: string
  data?: {
    synced: number      // 同步的笔记数量
    updated: number     // 更新的笔记数量
    total: number       // 总笔记数量
  }
}

/**
 * 同步账号的所有笔记（从聚光平台获取并保存到数据库）
 */
export async function syncRemoteNotes(accountId: string): Promise<SyncNotesResult> {
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

    if (account.status === 'cookie_expired') {
      return { success: false, error: 'Cookie 已过期，请重新登录' }
    }

    const accountObjId = new ObjectId(accountId)
    const now = new Date()
    let allNotes: RemoteNote[] = []
    let page = 1
    const pageSize = 20
    let hasMore = true

    // 遍历所有分页获取全部笔记
    while (hasMore) {
      const result = await queryChipsNotes(account.cookie, {
        page,
        pageSize,
      })

      if (result.list.length === 0) {
        hasMore = false
        break
      }

      // 转换为数据库格式
      for (const note of result.list) {
        allNotes.push({
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
        })
      }

      // 检查是否还有更多
      if (page * pageSize >= result.total) {
        hasMore = false
      } else {
        page++
        // 防止请求过快
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    // 批量更新或插入到数据库
    let updated = 0
    let inserted = 0
    const remoteNotesCollection = db.collection<RemoteNote>(COLLECTIONS.REMOTE_NOTES)

    for (const note of allNotes) {
      const existing = await remoteNotesCollection.findOne({
        accountId: accountObjId,
        noteId: note.noteId,
      })

      if (existing) {
        // 更新现有记录
        await remoteNotesCollection.updateOne(
          { _id: existing._id },
          {
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
          }
        )
        updated++
      } else {
        // 插入新记录
        await remoteNotesCollection.insertOne(note)
        inserted++
      }
    }

    // 更新账号的最后同步时间
    await db.collection(COLLECTIONS.ACCOUNTS).updateOne(
      { _id: accountObjId },
      { $set: { lastSyncAt: now, updatedAt: now } }
    )

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
    console.error('同步远程笔记失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '同步笔记失败',
    }
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
    console.error('获取已同步笔记失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取笔记列表失败',
    }
  }
}
