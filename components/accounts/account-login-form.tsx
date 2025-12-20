'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Cookie, KeyRound } from 'lucide-react'
import { verifyCookie, verifyPasswordLogin } from '@/actions/account'
import type { LoginType } from '@/types/account'

export interface LoginFormData {
  loginType: LoginType
  cookie: string
  email?: string
  password?: string
  userId: string
  advertiserId: string
  nickname: string
  avatar?: string
  balance: number
}

interface AccountLoginFormProps {
  /** 初始登录方式，默认为 password */
  defaultLoginType?: 'cookie' | 'password'
  /** 是否为更新模式（设置页面使用） */
  isUpdateMode?: boolean
  /** 初始邮箱（更新模式时使用） */
  initialEmail?: string
  /** 验证成功后的回调 */
  onSuccess: (data: LoginFormData) => void
  /** 取消按钮点击回调 */
  onCancel?: () => void
  /** 是否显示取消按钮 */
  showCancel?: boolean
  /** 验证按钮文字 */
  submitLabel?: string
}

export function AccountLoginForm({
  defaultLoginType = 'password',
  isUpdateMode = false,
  initialEmail = '',
  onSuccess,
  onCancel,
  showCancel = true,
  submitLabel,
}: AccountLoginFormProps) {
  const [loginType, setLoginType] = useState<'cookie' | 'password'>(defaultLoginType)
  const [cookie, setCookie] = useState('')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Cookie 方式验证
  async function handleVerifyCookie() {
    if (!cookie.trim()) {
      setError('请输入 Cookie')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await verifyCookie(cookie)
      if (result.success && result.data) {
        onSuccess({
          loginType: 'cookie',
          cookie,
          userId: result.data.userId,
          advertiserId: result.data.advertiserId,
          nickname: result.data.nickname,
          avatar: result.data.avatar,
          balance: result.data.balance,
        })
      } else {
        setError(result.error || '验证失败')
      }
    } catch {
      setError('验证失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 账号密码方式验证
  async function handleVerifyPassword() {
    if (!email.trim() || !password.trim()) {
      setError('请输入邮箱和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await verifyPasswordLogin(email, password)
      if (result.success && result.data) {
        onSuccess({
          loginType: 'password',
          cookie: result.data.cookie,
          email,
          password,
          userId: result.data.userId,
          advertiserId: result.data.advertiserId,
          nickname: result.data.nickname,
          avatar: result.data.avatar,
          balance: result.data.balance,
        })
      } else {
        setError(result.error || '登录失败')
      }
    } catch {
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 切换登录方式时清除错误
  function handleTabChange(value: string) {
    setLoginType(value as 'cookie' | 'password')
    setError('')
  }

  const passwordSubmitLabel = submitLabel || (isUpdateMode ? '重新登录' : '登录验证')
  const cookieSubmitLabel = submitLabel || (isUpdateMode ? '更新 Cookie' : '验证 Cookie')

  return (
    <Tabs value={loginType} onValueChange={handleTabChange}>
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="password" className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          账号密码
        </TabsTrigger>
        <TabsTrigger value="cookie" className="flex items-center gap-2">
          <Cookie className="h-4 w-4" />
          Cookie
        </TabsTrigger>
      </TabsList>

      <TabsContent value="password" className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            type="email"
            placeholder="请输入聚光平台登录邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            type="password"
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          使用小红书聚光平台 (ad.xiaohongshu.com) 的登录邮箱和密码
        </p>

        {error && (
          <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          {showCancel && onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button onClick={handleVerifyPassword} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isUpdateMode ? '登录中...' : '登录中...'}
              </>
            ) : (
              passwordSubmitLabel
            )}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="cookie" className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cookie">Cookie</Label>
          <Textarea
            id="cookie"
            placeholder="请粘贴小红书聚光平台的 Cookie"
            rows={6}
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            登录聚光平台 (ad.xiaohongshu.com) 后，按 F12 打开开发者工具，在 Network 标签中找到任意请求，复制 Request Headers 中的 Cookie
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          {showCancel && onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button onClick={handleVerifyCookie} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                验证中...
              </>
            ) : (
              cookieSubmitLabel
            )}
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  )
}
