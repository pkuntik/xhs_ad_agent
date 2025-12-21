import { MongoClient, Db } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI!
const DB_NAME = 'gpts'

if (!MONGODB_URI) {
  throw new Error('请在环境变量中配置 MONGODB_URI')
}

let client: MongoClient | null = null
let db: Db | null = null

export async function getDb(): Promise<Db> {
  if (db) return db

  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    })

    await client.connect()
    console.log('MongoDB 连接成功')
  }

  db = client.db(DB_NAME)
  return db
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close()
    client = null
    db = null
  }
}

// 集合名称常量
export const COLLECTIONS = {
  ACCOUNTS: 'accounts',
  WORKS: 'works',
  CAMPAIGNS: 'campaigns',
  DELIVERY_LOGS: 'delivery_logs',
  LEADS: 'leads',
  TASKS: 'tasks',
  AI_STRATEGIES: 'ai_strategies',
  // 用户和扣费系统
  USERS: 'users',
  TRANSACTIONS: 'transactions',
  PRICING: 'pricing',
  // 设置
  SETTINGS: 'settings',
  // 远程笔记（从聚光平台同步）
  REMOTE_NOTES: 'remote_notes',
  // 订单（从聚光平台同步）
  ORDERS: 'orders',
  // AI 创作历史
  CREATION_HISTORY: 'creation_history',
} as const
