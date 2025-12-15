import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getCurrentUserInfo } from '@/actions/auth'

export async function GET() {
  const payload = await getCurrentUser()

  if (!payload) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const user = await getCurrentUserInfo(payload.userId)

  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 })
  }

  return NextResponse.json({ user })
}
