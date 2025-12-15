import { ObjectId } from 'mongodb'

export type UserRole = 'user' | 'admin'
export type UserStatus = 'active' | 'suspended'

export interface User {
  _id: ObjectId
  username: string              // 登录用户名
  passwordHash: string          // 密码哈希 (bcrypt)
  email?: string                // 邮箱(可选)
  phone?: string                // 手机号(可选)
  role: UserRole                // 角色
  status: UserStatus            // 状态

  // 余额信息 (单位: 分)
  balance: number               // 账户余额
  totalRecharge: number         // 累计充值
  totalConsumed: number         // 累计消费

  // 账号限制
  maxAccounts: number           // 最大账号数(免费额度)
  currentAccounts: number       // 当前账号数

  // 审计字段
  lastLoginAt?: Date
  lastLoginIp?: string
  createdAt: Date
  updatedAt: Date
  createdBy?: ObjectId          // 创建者(管理员)
}

export interface CreateUserInput {
  username: string
  password: string
  email?: string
  phone?: string
  role?: UserRole
  maxAccounts?: number
  initialBalance?: number       // 初始余额(分)
}

export interface UpdateUserInput {
  email?: string
  phone?: string
  status?: UserStatus
  maxAccounts?: number
}

export interface LoginInput {
  username: string
  password: string
}

export interface UserInfo {
  id: string
  username: string
  role: UserRole
  status: UserStatus
  balance: number
  maxAccounts: number
  currentAccounts: number
}
