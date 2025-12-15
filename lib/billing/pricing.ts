import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import type { PricingItem } from '@/types/pricing'
import type { BillingAction } from '@/types/transaction'
import { DEFAULT_PRICING } from '@/types/pricing'

/**
 * 获取功能价格
 */
export async function getPrice(action: BillingAction): Promise<number> {
  const db = await getDb()
  const pricing = await db
    .collection<PricingItem>(COLLECTIONS.PRICING)
    .findOne({ action, enabled: true })

  if (pricing) {
    return pricing.price
  }

  // 返回默认价格
  return DEFAULT_PRICING[action]?.price ?? 0
}

/**
 * 获取所有价格配置
 */
export async function getAllPricing(): Promise<PricingItem[]> {
  const db = await getDb()
  const items = await db
    .collection<PricingItem>(COLLECTIONS.PRICING)
    .find()
    .sort({ sortOrder: 1 })
    .toArray()

  return items
}

/**
 * 初始化价格配置 (首次运行时调用)
 */
export async function initializePricing(): Promise<void> {
  const db = await getDb()
  const collection = db.collection<PricingItem>(COLLECTIONS.PRICING)

  const now = new Date()
  let sortOrder = 0

  for (const [action, config] of Object.entries(DEFAULT_PRICING)) {
    const exists = await collection.findOne({ action: action as BillingAction })
    if (!exists) {
      await collection.insertOne({
        action: action as BillingAction,
        name: config.name,
        description: config.description,
        price: config.price,
        enabled: true,
        sortOrder: sortOrder++,
        createdAt: now,
        updatedAt: now,
      } as PricingItem)
    }
  }
}
