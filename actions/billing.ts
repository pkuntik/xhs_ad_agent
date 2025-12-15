'use server'

import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { getCurrentUserId } from '@/lib/auth/session'
import type { Transaction } from '@/types/transaction'
import type { User } from '@/types/user'

/**
 * 获取当前用户的交易记录
 */
export async function getMyTransactions() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  const db = await getDb()
  const transactions = await db
    .collection<Transaction>(COLLECTIONS.TRANSACTIONS)
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray()

  // 序列化 ObjectId 和 Date
  return JSON.parse(JSON.stringify(transactions))
}

/**
 * 获取当前用户的余额信息
 */
export async function getMyBalance(): Promise<{
  balance: number
  totalRecharge: number
  totalConsumed: number
} | null> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  const db = await getDb()
  const user = await db
    .collection<User>(COLLECTIONS.USERS)
    .findOne({ _id: new ObjectId(userId) })

  if (!user) {
    return null
  }

  return {
    balance: user.balance,
    totalRecharge: user.totalRecharge,
    totalConsumed: user.totalConsumed,
  }
}
