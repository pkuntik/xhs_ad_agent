'use server'

import { cookies } from 'next/headers'
import { ObjectId } from 'mongodb'
import { getDb, COLLECTIONS } from '@/lib/db/mongodb'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { signToken } from '@/lib/auth/jwt'
import { AUTH_COOKIE_NAME, getCurrentUserId } from '@/lib/auth/session'
import type { User, LoginInput, CreateUserInput, UserInfo } from '@/types/user'

/**
 * 用户登录
 */
export async function login(input: LoginInput): Promise<{
  success: boolean
  error?: string
  user?: UserInfo
}> {
  try {
    const { username, password } = input

    if (!username || !password) {
      return { success: false, error: '请输入用户名和密码' }
    }

    const db = await getDb()
    const user = await db.collection<User>(COLLECTIONS.USERS).findOne({
      username: username.toLowerCase().trim()
    })

    if (!user) {
      return { success: false, error: '用户名或密码错误' }
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return { success: false, error: '用户名或密码错误' }
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return { success: false, error: '账号已被禁用' }
    }

    // 生成 token
    const token = await signToken({
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
    })

    // 设置 cookie
    const cookieStore = await cookies()
    cookieStore.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    })

    // 更新最后登录时间
    await db.collection<User>(COLLECTIONS.USERS).updateOne(
      { _id: user._id },
      {
        $set: {
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        }
      }
    )

    return {
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        status: user.status,
        balance: user.balance,
        maxAccounts: user.maxAccounts,
        currentAccounts: user.currentAccounts,
      }
    }
  } catch (error: any) {
    console.error('登录失败:', error)
    return { success: false, error: '登录失败，请重试' }
  }
}

/**
 * 用户登出
 */
export async function logout(): Promise<{ success: boolean }> {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE_NAME)
  return { success: true }
}

/**
 * 创建用户 (管理员操作)
 */
export async function createUser(input: CreateUserInput): Promise<{
  success: boolean
  error?: string
  id?: string
}> {
  try {
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
    }

    const result = await db.collection<User>(COLLECTIONS.USERS).insertOne(user as User)

    return {
      success: true,
      id: result.insertedId.toString(),
    }
  } catch (error: any) {
    console.error('创建用户失败:', error)
    return { success: false, error: '创建用户失败' }
  }
}

/**
 * 获取用户信息
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const db = await getDb()
    const user = await db.collection<User>(COLLECTIONS.USERS).findOne({
      _id: new ObjectId(userId)
    })
    return user
  } catch {
    return null
  }
}

/**
 * 获取当前用户信息 (包含余额等)
 */
export async function getCurrentUserInfo(): Promise<UserInfo | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const user = await getUserById(userId)
  if (!user) return null

  return {
    id: user._id.toString(),
    username: user.username,
    role: user.role,
    status: user.status,
    balance: user.balance,
    maxAccounts: user.maxAccounts,
    currentAccounts: user.currentAccounts,
  }
}
