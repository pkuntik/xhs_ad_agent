import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { getPrice } from './pricing'
import type { User } from '@/types/user'
import type { Transaction, BillingAction } from '@/types/transaction'
import { DEFAULT_PRICING, formatPrice } from '@/types/pricing'

export interface BillingResult {
  success: boolean
  error?: string
  transactionId?: string
  balanceAfter?: number
}

export interface CheckBalanceResult {
  sufficient: boolean
  required: number
  current: number
  actionName: string
}

/**
 * 检查余额是否足够
 */
export async function checkBalance(
  userId: string,
  action: BillingAction
): Promise<CheckBalanceResult> {
  const db = await getDb()
  const user = await db
    .collection<User>(COLLECTIONS.USERS)
    .findOne({ _id: new ObjectId(userId) })

  if (!user) {
    return {
      sufficient: false,
      required: 0,
      current: 0,
      actionName: DEFAULT_PRICING[action]?.name || action,
    }
  }

  const price = await getPrice(action)

  return {
    sufficient: user.balance >= price,
    required: price,
    current: user.balance,
    actionName: DEFAULT_PRICING[action]?.name || action,
  }
}

/**
 * 执行扣费 (原子操作)
 */
export async function deductBalance(
  userId: string,
  action: BillingAction,
  options?: {
    relatedId?: string
    relatedType?: string
    description?: string
    metadata?: Record<string, unknown>
  }
): Promise<BillingResult> {
  const db = await getDb()

  try {
    // 获取价格
    const price = await getPrice(action)

    // 如果价格为0，直接返回成功
    if (price <= 0) {
      return { success: true, balanceAfter: 0 }
    }

    // 原子更新余额 (确保余额足够)
    const updateResult = await db.collection<User>(COLLECTIONS.USERS).findOneAndUpdate(
      {
        _id: new ObjectId(userId),
        balance: { $gte: price },
      },
      {
        $inc: {
          balance: -price,
          totalConsumed: price,
        },
        $set: { updatedAt: new Date() },
      },
      {
        returnDocument: 'after',
      }
    )

    if (!updateResult) {
      // 获取当前余额用于错误提示
      const user = await db.collection<User>(COLLECTIONS.USERS).findOne({
        _id: new ObjectId(userId)
      })
      const currentBalance = user?.balance ?? 0
      return {
        success: false,
        error: `余额不足，需要 ${formatPrice(price)}，当前余额 ${formatPrice(currentBalance)}`
      }
    }

    // 记录交易
    const transaction: Omit<Transaction, '_id'> = {
      userId: new ObjectId(userId),
      type: 'consume',
      action,
      amount: -price,
      balanceBefore: updateResult.balance + price,
      balanceAfter: updateResult.balance,
      relatedId: options?.relatedId ? new ObjectId(options.relatedId) : undefined,
      relatedType: options?.relatedType,
      description: options?.description || DEFAULT_PRICING[action]?.name || action,
      metadata: options?.metadata,
      createdAt: new Date(),
    }

    const transResult = await db.collection<Transaction>(COLLECTIONS.TRANSACTIONS).insertOne(transaction as Transaction)

    return {
      success: true,
      transactionId: transResult.insertedId.toString(),
      balanceAfter: updateResult.balance,
    }
  } catch (error) {
    console.error('扣费失败:', error)
    return { success: false, error: '扣费失败，请重试' }
  }
}

/**
 * 执行充值 (管理员操作)
 */
export async function rechargeBalance(
  userId: string,
  amount: number,
  adminId: string,
  note?: string
): Promise<BillingResult> {
  const db = await getDb()

  try {
    if (amount <= 0) {
      return { success: false, error: '充值金额必须大于0' }
    }

    // 获取当前用户
    const user = await db.collection<User>(COLLECTIONS.USERS).findOne({
      _id: new ObjectId(userId)
    })

    if (!user) {
      return { success: false, error: '用户不存在' }
    }

    // 更新余额
    const updateResult = await db.collection<User>(COLLECTIONS.USERS).findOneAndUpdate(
      { _id: new ObjectId(userId) },
      {
        $inc: {
          balance: amount,
          totalRecharge: amount,
        },
        $set: { updatedAt: new Date() },
      },
      {
        returnDocument: 'after',
      }
    )

    if (!updateResult) {
      return { success: false, error: '充值失败' }
    }

    // 记录交易
    const transaction: Omit<Transaction, '_id'> = {
      userId: new ObjectId(userId),
      type: 'recharge',
      amount: amount,
      balanceBefore: user.balance,
      balanceAfter: updateResult.balance,
      rechargeBy: new ObjectId(adminId),
      rechargeNote: note,
      description: `管理员充值 ${formatPrice(amount)}`,
      createdAt: new Date(),
    }

    const transResult = await db.collection<Transaction>(COLLECTIONS.TRANSACTIONS).insertOne(transaction as Transaction)

    return {
      success: true,
      transactionId: transResult.insertedId.toString(),
      balanceAfter: updateResult.balance,
    }
  } catch (error) {
    console.error('充值失败:', error)
    return { success: false, error: '充值失败，请重试' }
  }
}

/**
 * 获取用户余额
 */
export async function getUserBalance(userId: string): Promise<number> {
  const db = await getDb()
  const user = await db.collection<User>(COLLECTIONS.USERS).findOne({
    _id: new ObjectId(userId)
  })
  return user?.balance ?? 0
}
