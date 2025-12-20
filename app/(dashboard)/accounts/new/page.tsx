'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createAccount, createAccountByPassword } from '@/actions/account'
import { AccountLoginForm, type LoginFormData } from '@/components/accounts/account-login-form'
import { User, Wallet, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react'

type Step = 'input' | 'confirm'

interface AccountPreview extends LoginFormData {
  // LoginFormData 已包含所有需要的字段
}

export default function NewAccountPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accountPreview, setAccountPreview] = useState<AccountPreview | null>(null)

  // 验证成功后的回调
  function handleLoginSuccess(data: LoginFormData) {
    setAccountPreview(data)
    setStep('confirm')
  }

  // 确认添加
  async function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!accountPreview) return

    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const dailyBudget = Number(formData.get('dailyBudget')) || 5000
    const defaultBidAmount = Number(formData.get('defaultBidAmount')) || 30

    try {
      let result

      if (accountPreview.loginType === 'cookie') {
        result = await createAccount({
          cookie: accountPreview.cookie,
          dailyBudget,
          defaultBidAmount,
        })
      } else {
        result = await createAccountByPassword({
          email: accountPreview.email!,
          password: accountPreview.password!,
          dailyBudget,
          defaultBidAmount,
        })
      }

      if (result.success) {
        router.push('/accounts')
        router.refresh()
      } else {
        setError(result.error || '添加失败')
      }
    } catch {
      setError('添加失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 返回上一步
  function handleBack() {
    setStep('input')
    setAccountPreview(null)
    setError('')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">添加账号</h2>
        <p className="text-muted-foreground">
          添加小红书聚光平台账号
        </p>
      </div>

      {step === 'input' && (
        <Card>
          <CardHeader>
            <CardTitle>选择登录方式</CardTitle>
            <CardDescription>
              支持账号密码登录或 Cookie 方式添加账号
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AccountLoginForm
              defaultLoginType="password"
              onSuccess={handleLoginSuccess}
              onCancel={() => router.back()}
            />
          </CardContent>
        </Card>
      )}

      {step === 'confirm' && accountPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              验证成功
            </CardTitle>
            <CardDescription>
              请确认账号信息，然后点击添加
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* 账号信息预览 */}
            <div className="mb-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  {accountPreview.avatar ? (
                    <img
                      src={accountPreview.avatar}
                      alt={accountPreview.nickname}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{accountPreview.nickname}</h3>
                  <p className="text-sm text-muted-foreground">
                    用户ID: {accountPreview.userId}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    广告主ID: {accountPreview.advertiserId}
                  </p>
                  {accountPreview.loginType === 'password' && (
                    <p className="text-sm text-green-600">
                      登录方式: 账号密码
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-lg font-semibold">
                    <Wallet className="h-4 w-4" />
                    ¥{accountPreview.balance.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">账户余额</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleConfirm} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dailyBudget">每日预算上限（元）</Label>
                  <Input
                    id="dailyBudget"
                    name="dailyBudget"
                    type="number"
                    placeholder="5000"
                    defaultValue={5000}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultBidAmount">默认出价（元）</Label>
                  <Input
                    id="defaultBidAmount"
                    name="defaultBidAmount"
                    type="number"
                    placeholder="30"
                    defaultValue={30}
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回修改
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      添加中...
                    </>
                  ) : (
                    '确认添加'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
