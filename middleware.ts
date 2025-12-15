import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'

const AUTH_COOKIE_NAME = 'auth-token'

// 公开路径 (无需登录)
const publicPaths = [
  '/login',
  '/api/auth/login',
  '/api/init',  // 初始化管理员
  '/p/',  // 发布页面
]

// 静态资源路径
const staticPaths = [
  '/_next',
  '/favicon.ico',
  '/api/image/placeholder',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 静态资源直接放行
  if (staticPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 公开路径直接放行
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 获取 token
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value

  if (!token) {
    // API 返回 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      )
    }
    // 页面重定向到登录
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 验证 token
  const payload = await verifyToken(token)
  if (!payload) {
    // 清除无效 cookie
    const response = pathname.startsWith('/api/')
      ? NextResponse.json(
          { success: false, error: '登录已过期' },
          { status: 401 }
        )
      : NextResponse.redirect(new URL('/login', request.url))

    response.cookies.delete(AUTH_COOKIE_NAME)
    return response
  }

  // 检查用户状态 (可选: 这里只是注入用户信息，具体权限检查在业务层)

  // 注入用户信息到请求头
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', payload.userId)
  requestHeaders.set('x-user-name', payload.username)
  requestHeaders.set('x-user-role', payload.role)

  return NextResponse.next({
    request: { headers: requestHeaders }
  })
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
