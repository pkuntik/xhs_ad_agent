'use server'

import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { hashPassword } from '@/lib/auth/password'
import { requireAdmin, getCurrentUserId } from '@/lib/auth/session'
import { rechargeBalance } from '@/lib/billing/service'
import { initializePricing, getAllPricing } from '@/lib/billing/pricing'
import type { User, CreateUserInput, UpdateUserInput, UserRole } from '@/types/user'
import type { Transaction, TransactionFilter } from '@/types/transaction'
import type { PricingItem, UpdatePricingInput } from '@/types/pricing'

/**
 * 获取用户列表 (管理员)
 */
export async function getUsers() {
  await requireAdmin()

  const db = await getDb()
  const users = await db
    .collection<User>(COLLECTIONS.USERS)
    .find({})
    .sort({ createdAt: -1 })
    .toArray()

  // 不返回密码哈希，序列化 ObjectId
  return JSON.parse(JSON.stringify(users.map(u => ({ ...u, passwordHash: '' }))))
}

/**
 * 获取单个用户详情 (管理员)
 */
export async function getUserDetail(userId: string) {
  await requireAdmin()

  const db = await getDb()
  const user = await db
    .collection<User>(COLLECTIONS.USERS)
    .findOne({ _id: new ObjectId(userId) })

  if (!user) return null

  user.passwordHash = ''  // 不返回密码哈希
  return JSON.parse(JSON.stringify(user))
}

/**
 * 创建用户 (管理员)
 */
export async function adminCreateUser(input: CreateUserInput): Promise<{
  success: boolean
  error?: string
  id?: string
}> {
  const admin = await requireAdmin()

  const {
    username,
    password,
    email,
    phone,
    role = 'user',
    maxAccounts = 3,
    initialBalance = 0,
  } = input

  if (!username || !password) {
    return { success: false, error: '用户名和密码不能为空' }
  }

  if (password.length < 6) {
    return { success: false, error: '密码至少6位' }
  }

  const db = await getDb()

  // 检查用户名是否已存在
  const existing = await db.collection<User>(COLLECTIONS.USERS).findOne({
    username: username.toLowerCase().trim()
  })

  if (existing) {
    return { success: false, error: '用户名已存在' }
  }

  // 加密密码
  const passwordHash = await hashPassword(password)

  const now = new Date()
  const user: Omit<User, '_id'> = {
    username: username.toLowerCase().trim(),
    passwordHash,
    email: email?.trim(),
    phone: phone?.trim(),
    role,
    status: 'active',
    balance: initialBalance,
    totalRecharge: initialBalance,
    totalConsumed: 0,
    maxAccounts,
    currentAccounts: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: new ObjectId(admin.userId),
  }

  const result = await db.collection<User>(COLLECTIONS.USERS).insertOne(user as User)

  // 如果有初始余额，记录交易
  if (initialBalance > 0) {
    await db.collection<Transaction>(COLLECTIONS.TRANSACTIONS).insertOne({
      userId: result.insertedId,
      type: 'recharge',
      amount: initialBalance,
      balanceBefore: 0,
      balanceAfter: initialBalance,
      rechargeBy: new ObjectId(admin.userId),
      rechargeNote: '开户初始余额',
      description: `开户充值 ¥${(initialBalance / 100).toFixed(2)}`,
      createdAt: now,
    } as Transaction)
  }

  return { success: true, id: result.insertedId.toString() }
}

/**
 * 更新用户信息 (管理员)
 */
export async function adminUpdateUser(
  userId: string,
  input: UpdateUserInput
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const db = await getDb()

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (input.email !== undefined) updateData.email = input.email
  if (input.phone !== undefined) updateData.phone = input.phone
  if (input.status !== undefined) updateData.status = input.status
  if (input.maxAccounts !== undefined) updateData.maxAccounts = input.maxAccounts

  await db.collection<User>(COLLECTIONS.USERS).updateOne(
    { _id: new ObjectId(userId) },
    { $set: updateData }
  )

  return { success: true }
}

/**
 * 重置用户密码 (管理员)
 */
export async function adminResetPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: '密码至少6位' }
  }

  const passwordHash = await hashPassword(newPassword)

  const db = await getDb()
  await db.collection<User>(COLLECTIONS.USERS).updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        passwordHash,
        updatedAt: new Date(),
      }
    }
  )

  return { success: true }
}

/**
 * 充值 (管理员)
 */
export async function adminRecharge(
  userId: string,
  amountYuan: number,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()

  if (amountYuan <= 0) {
    return { success: false, error: '充值金额必须大于0' }
  }

  // 转换为分
  const amountCents = Math.round(amountYuan * 100)

  const result = await rechargeBalance(userId, amountCents, admin.userId, note)
  return result
}

/**
 * 获取交易记录 (管理员)
 */
export async function getTransactions(filter?: TransactionFilter) {
  await requireAdmin()

  const db = await getDb()
  const query: Record<string, unknown> = {}

  if (filter?.userId) {
    query.userId = new ObjectId(filter.userId)
  }
  if (filter?.type) {
    query.type = filter.type
  }
  if (filter?.action) {
    query.action = filter.action
  }
  if (filter?.startDate || filter?.endDate) {
    query.createdAt = {}
    if (filter.startDate) {
      (query.createdAt as Record<string, Date>).$gte = filter.startDate
    }
    if (filter.endDate) {
      (query.createdAt as Record<string, Date>).$lte = filter.endDate
    }
  }

  const transactions = await db
    .collection<Transaction>(COLLECTIONS.TRANSACTIONS)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray()

  return JSON.parse(JSON.stringify(transactions))
}

/**
 * 获取价格配置列表 (管理员)
 */
export async function getPricingList() {
  await requireAdmin()

  // 确保价格配置已初始化
  await initializePricing()

  const items = await getAllPricing()
  return JSON.parse(JSON.stringify(items))
}

/**
 * 更新价格配置 (管理员)
 */
export async function updatePricing(
  pricingId: string,
  input: UpdatePricingInput
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const db = await getDb()

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (input.price !== undefined) {
    if (input.price < 0) {
      return { success: false, error: '价格不能为负' }
    }
    updateData.price = input.price
  }
  if (input.enabled !== undefined) updateData.enabled = input.enabled
  if (input.description !== undefined) updateData.description = input.description

  await db.collection<PricingItem>(COLLECTIONS.PRICING).updateOne(
    { _id: new ObjectId(pricingId) },
    { $set: updateData }
  )

  return { success: true }
}

/**
 * 初始化默认管理员账号 (首次运行)
 */
export async function initializeAdmin(): Promise<{
  success: boolean
  message: string
  credentials?: { username: string; password: string }
}> {
  const db = await getDb()

  // 检查是否已有管理员
  const existingAdmin = await db.collection<User>(COLLECTIONS.USERS).findOne({
    role: 'admin'
  })

  if (existingAdmin) {
    return { success: true, message: '管理员账号已存在' }
  }

  // 创建默认管理员
  const defaultPassword = 'admin123'
  const passwordHash = await hashPassword(defaultPassword)

  const now = new Date()
  const admin: Omit<User, '_id'> = {
    username: 'admin',
    passwordHash,
    role: 'admin',
    status: 'active',
    balance: 0,
    totalRecharge: 0,
    totalConsumed: 0,
    maxAccounts: 999,
    currentAccounts: 0,
    createdAt: now,
    updatedAt: now,
  }

  await db.collection<User>(COLLECTIONS.USERS).insertOne(admin as User)

  // 初始化价格配置
  await initializePricing()

  return {
    success: true,
    message: '管理员账号创建成功',
    credentials: {
      username: 'admin',
      password: defaultPassword,
    }
  }
}
