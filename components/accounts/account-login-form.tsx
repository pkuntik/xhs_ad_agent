'use client'

import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Cookie, KeyRound, QrCode, RefreshCw, CheckCircle } from 'lucide-react'
import { verifyCookie, verifyPasswordLogin, getLoginQRCode, checkLoginQRCodeStatus } from '@/actions/account'
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
  defaultLoginType?: 'cookie' | 'password' | 'qrcode'
  /** 是否为更新模式（设置页面使用） */
  isUpdateMode?: boolean
  /** 初始邮箱（更新模式时使用） */
  initialEmail?: string
  /** 初始密码（更新模式时使用） */
  initialPassword?: string
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
  initialPassword = '',
  onSuccess,
  onCancel,
  showCancel = true,
  submitLabel,
}: AccountLoginFormProps) {
  const [loginType, setLoginType] = useState<'cookie' | 'password' | 'qrcode'>(defaultLoginType)
  const [cookie, setCookie] = useState('')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState(initialPassword)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 扫码登录相关状态
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [qrCodeId, setQrCodeId] = useState<string | null>(null)
  const [qrStatus, setQrStatus] = useState<'idle' | 'loading' | 'waiting' | 'scanned' | 'confirmed' | 'expired'>('idle')
  const [qrPolling, setQrPolling] = useState(false)

  // 获取二维码
  const fetchQRCode = useCallback(async () => {
    setQrStatus('loading')
    setError('')

    try {
      const result = await getLoginQRCode()
      if (result.success && result.qrCodeUrl && result.qrCodeId) {
        setQrCodeUrl(result.qrCodeUrl)
        setQrCodeId(result.qrCodeId)
        setQrStatus('waiting')
        setQrPolling(true)
      } else {
        setError(result.error || '获取二维码失败')
        setQrStatus('expired')
      }
    } catch {
      setError('获取二维码失败')
      setQrStatus('expired')
    }
  }, [])

  // 轮询二维码状态
  useEffect(() => {
    if (!qrPolling || !qrCodeId || loginType !== 'qrcode') return

    let timeoutId: NodeJS.Timeout

    async function pollStatus() {
      try {
        const result = await checkLoginQRCodeStatus(qrCodeId!)

        if (result.status === 'confirmed' && result.cookie) {
          setQrPolling(false)
          setQrStatus('confirmed')
          // 验证 Cookie 获取用户信息
          const verifyResult = await verifyCookie(result.cookie)
          if (verifyResult.success && verifyResult.data) {
            onSuccess({
              loginType: 'qrcode',
              cookie: result.cookie,
              userId: verifyResult.data.userId,
              advertiserId: verifyResult.data.advertiserId,
              nickname: verifyResult.data.nickname,
              avatar: verifyResult.data.avatar,
              balance: verifyResult.data.balance,
            })
          } else {
            setError(verifyResult.error || '验证失败')
            setQrStatus('expired')
          }
          return
        }

        if (result.status === 'expired') {
          setQrPolling(false)
          setQrStatus('expired')
          setError('二维码已过期，请刷新')
          return
        }

        if (result.status === 'scanned') {
          setQrStatus('scanned')
        }

        // 继续轮询
        timeoutId = setTimeout(pollStatus, 2000)
      } catch {
        setQrPolling(false)
        setQrStatus('expired')
        setError('检查状态失败')
      }
    }

    // 开始轮询
    timeoutId = setTimeout(pollStatus, 2000)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [qrPolling, qrCodeId, loginType, onSuccess])

  // 切换到扫码标签时获取二维码
  useEffect(() => {
    if (loginType === 'qrcode' && !qrCodeUrl && qrStatus === 'idle') {
      fetchQRCode()
    }
  }, [loginType, qrCodeUrl, qrStatus, fetchQRCode])

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

  // 刷新二维码
  function handleRefreshQRCode() {
    setQrCodeUrl(null)
    setQrCodeId(null)
    setQrPolling(false)
    setError('')
    fetchQRCode()
  }

  // 切换登录方式时清除错误
  function handleTabChange(value: string) {
    setLoginType(value as 'cookie' | 'password' | 'qrcode')
    setError('')
  }

  const passwordSubmitLabel = submitLabel || (isUpdateMode ? '重新登录' : '登录验证')
  const cookieSubmitLabel = submitLabel || (isUpdateMode ? '更新 Cookie' : '验证 Cookie')

  return (
    <Tabs value={loginType} onValueChange={handleTabChange}>
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="qrcode" className="flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          扫码登录
        </TabsTrigger>
        <TabsTrigger value="password" className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          账号密码
        </TabsTrigger>
        <TabsTrigger value="cookie" className="flex items-center gap-2">
          <Cookie className="h-4 w-4" />
          Cookie
        </TabsTrigger>
      </TabsList>

      {/* 扫码登录 */}
      <TabsContent value="qrcode" className="space-y-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative p-4 bg-white rounded-lg border">
            {(qrStatus === 'idle' || qrStatus === 'loading') ? (
              <div className="w-48 h-48 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : qrStatus === 'expired' ? (
              <div className="w-48 h-48 flex flex-col items-center justify-center text-muted-foreground">
                <p className="text-sm mb-2">二维码已过期</p>
                <Button variant="outline" size="sm" onClick={handleRefreshQRCode}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  刷新
                </Button>
              </div>
            ) : qrStatus === 'confirmed' ? (
              <div className="w-48 h-48 flex flex-col items-center justify-center text-green-600">
                <CheckCircle className="h-12 w-12 mb-2" />
                <p className="text-sm">登录成功</p>
              </div>
            ) : qrCodeUrl ? (
              <>
                <QRCodeSVG value={qrCodeUrl} size={192} />
                {qrStatus === 'scanned' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <div className="bg-white px-4 py-2 rounded-full text-sm">
                      已扫码，请在手机上确认
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-48 h-48 flex items-center justify-center">
                <Button variant="outline" onClick={handleRefreshQRCode}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  获取二维码
                </Button>
              </div>
            )}
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm font-medium">
              {qrStatus === 'waiting' && '请使用小红书/聚光/千帆 App 扫码'}
              {qrStatus === 'scanned' && '已扫码，等待确认...'}
              {qrStatus === 'loading' && '正在加载...'}
            </p>
            <p className="text-xs text-muted-foreground">
              支持小红书 App、聚光 App、千帆 App 扫码登录
            </p>
          </div>

          {qrStatus === 'waiting' && (
            <Button variant="ghost" size="sm" onClick={handleRefreshQRCode}>
              <RefreshCw className="h-4 w-4 mr-1" />
              刷新二维码
            </Button>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md text-center">
            {error}
          </div>
        )}

        {showCancel && onCancel && (
          <div className="flex justify-center pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
          </div>
        )}
      </TabsContent>

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
            type="text"
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
