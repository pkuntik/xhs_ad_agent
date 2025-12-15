import { cookies, headers } from 'next/headers'
import { verifyToken, type JwtPayload } from './jwt'

export const AUTH_COOKIE_NAME = 'auth-token'

/**
 * 从 Cookie 获取当前用户信息
 * 用于 Server Components 和 Server Actions
 */
export async function getCurrentUser(): Promise<JwtPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  return verifyToken(token)
}

/**
 * 获取当前用户ID
 * 用于 Server Actions
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.userId ?? null
}

/**
 * 检查当前用户是否为管理员
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === 'admin'
}

/**
 * 从请求头获取用户信息
 * 用于 API 路由 (由 middleware 注入)
 */
export async function getUserFromHeaders(): Promise<JwtPayload | null> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  const username = headersList.get('x-user-name')
  const role = headersList.get('x-user-role')

  if (!userId || !username || !role) {
    return null
  }

  return {
    userId,
    username,
    role: role as JwtPayload['role'],
  }
}

/**
 * 要求用户已登录，否则抛出错误
 */
export async function requireAuth(): Promise<JwtPayload> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('请先登录')
  }
  return user
}

/**
 * 要求管理员权限，否则抛出错误
 */
export async function requireAdmin(): Promise<JwtPayload> {
  const user = await requireAuth()
  if (user.role !== 'admin') {
    throw new Error('需要管理员权限')
  }
  return user
}
