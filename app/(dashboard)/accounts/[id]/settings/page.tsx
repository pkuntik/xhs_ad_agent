'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getAccountById,
  updateAccount,
  updateAccountCookie,
  updateAccountByPassword,
  updateAccountThresholds,
} from '@/actions/account'
import { AccountLoginForm, type LoginFormData } from '@/components/accounts/account-login-form'
import type { AccountListItem } from '@/types/account'

interface SettingsPageProps {
  params: Promise<{ id: string }>
}

export default function AccountSettingsPage({ params }: SettingsPageProps) {
  const [id, setId] = useState<string>('')
  const [account, setAccount] = useState<AccountListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingCredentials, setSavingCredentials] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 表单状态
  const [name, setName] = useState('')
  const [dailyBudget, setDailyBudget] = useState(5000)
  const [defaultBidAmount, setDefaultBidAmount] = useState(30)
  const [minConsumption, setMinConsumption] = useState(100)
  const [maxCostPerLead, setMaxCostPerLead] = useState(50)
  const [maxFailRetries, setMaxFailRetries] = useState(3)

  useEffect(() => {
    params.then(({ id }) => {
      setId(id)
      loadAccount(id)
    })
  }, [params])

  async function loadAccount(accountId: string) {
    setLoading(true)
    const data = await getAccountById(accountId)
    if (data) {
      setAccount(data)
      setName(data.name)
      setDailyBudget(data.dailyBudget)
      setDefaultBidAmount(data.defaultBidAmount)
      setMinConsumption(data.thresholds.minConsumption)
      setMaxCostPerLead(data.thresholds.maxCostPerLead)
      setMaxFailRetries(data.thresholds.maxFailRetries)
    }
    setLoading(false)
  }

  async function handleSaveBasic(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const result = await updateAccount(id, {
      name,
      dailyBudget,
      defaultBidAmount,
    })

    if (result.success) {
      setMessage({ type: 'success', text: '基本信息已保存' })
    } else {
      setMessage({ type: 'error', text: result.error || '保存失败' })
    }
    setSaving(false)
  }

  async function handleSaveThresholds(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const result = await updateAccountThresholds(id, {
      minConsumption,
      maxCostPerLead,
      maxFailRetries,
    })

    if (result.success) {
      setMessage({ type: 'success', text: '阈值配置已保存' })
    } else {
      setMessage({ type: 'error', text: result.error || '保存失败' })
    }
    setSaving(false)
  }

  // 更新登录凭证
  async function handleUpdateCredentials(data: LoginFormData) {
    setSavingCredentials(true)
    setMessage(null)

    let result

    if (data.loginType === 'cookie') {
      result = await updateAccountCookie(id, data.cookie)
    } else {
      result = await updateAccountByPassword(id, data.email!, data.password!)
    }

    if (result.success) {
      setMessage({ type: 'success', text: '登录凭证已更新' })
      loadAccount(id) // 重新加载账号信息
    } else {
      setMessage({ type: 'error', text: result.error || '更新失败' })
    }
    setSavingCredentials(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">账号不存在</p>
        <Link href="/accounts">
          <Button variant="link">返回账号列表</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 头部 */}
      <div className="flex items-center space-x-4">
        <Link href={`/accounts/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">账号设置</h2>
          <p className="text-muted-foreground">{account.name}</p>
        </div>
      </div>

      {/* 消息提示 */}
      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>修改账号名称和默认配置</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveBasic} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">账号名称</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="账号名称"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dailyBudget">每日预算上限（元）</Label>
                <Input
                  id="dailyBudget"
                  type="number"
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultBidAmount">默认出价（元）</Label>
                <Input
                  id="defaultBidAmount"
                  type="number"
                  value={defaultBidAmount}
                  onChange={(e) => setDefaultBidAmount(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                保存
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 效果阈值 */}
      <Card>
        <CardHeader>
          <CardTitle>效果阈值</CardTitle>
          <CardDescription>自动托管时的效果判断标准</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveThresholds} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="minConsumption">最低消耗检查阈值（元）</Label>
              <Input
                id="minConsumption"
                type="number"
                value={minConsumption}
                onChange={(e) => setMinConsumption(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                消耗达到此金额后开始检查投放效果
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxCostPerLead">单次咨询成本上限（元）</Label>
              <Input
                id="maxCostPerLead"
                type="number"
                value={maxCostPerLead}
                onChange={(e) => setMaxCostPerLead(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                超过此成本视为效果不佳，触发重投
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxFailRetries">最大失败重试次数</Label>
              <Input
                id="maxFailRetries"
                type="number"
                value={maxFailRetries}
                onChange={(e) => setMaxFailRetries(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                连续失败达到此次数后，建议更换作品
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                保存
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 更新登录凭证 */}
      <Card>
        <CardHeader>
          <CardTitle>更新登录凭证</CardTitle>
          <CardDescription>
            当 Cookie 过期时，重新登录聚光平台更新凭证
            {account.loginType === 'password' && account.loginEmail && (
              <span className="block mt-1 text-green-600">
                当前使用账号密码登录: {account.loginEmail}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {savingCredentials ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">更新中...</span>
            </div>
          ) : (
            <AccountLoginForm
              defaultLoginType={account.loginType === 'password' ? 'password' : 'cookie'}
              isUpdateMode
              initialEmail={account.loginEmail}
              onSuccess={handleUpdateCredentials}
              showCancel={false}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
