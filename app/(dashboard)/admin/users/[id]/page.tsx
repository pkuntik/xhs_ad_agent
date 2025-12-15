'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { getUserDetail, adminUpdateUser, adminRecharge, adminResetPassword, getTransactions } from '@/actions/admin'
import { formatBalance } from '@/types/pricing'
import type { User } from '@/types/user'
import type { Transaction } from '@/types/transaction'

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // 充值表单
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [rechargeNote, setRechargeNote] = useState('')
  const [recharging, setRecharging] = useState(false)

  // 重置密码表单
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const { id } = await params
      const [userData, transData] = await Promise.all([
        getUserDetail(id),
        getTransactions({ userId: id })
      ])
      setUser(userData)
      setTransactions(transData)
      setLoading(false)
    }
    loadData()
  }, [params])

  const handleStatusChange = async (status: 'active' | 'suspended') => {
    if (!user) return
    setSaving(true)
    setError('')
    setMessage('')

    const result = await adminUpdateUser(user._id.toString(), { status })
    if (result.success) {
      setUser(prev => prev ? { ...prev, status } : null)
      setMessage('状态已更新')
    } else {
      setError(result.error || '更新失败')
    }
    setSaving(false)
  }

  const handleRecharge = async () => {
    if (!user) return
    const amount = parseFloat(rechargeAmount)
    if (!amount || amount <= 0) {
      setError('请输入有效金额')
      return
    }

    setRecharging(true)
    setError('')
    setMessage('')

    const result = await adminRecharge(user._id.toString(), amount, rechargeNote)
    if (result.success) {
      setMessage(`充值成功: ¥${amount.toFixed(2)}`)
      setRechargeAmount('')
      setRechargeNote('')
      // 刷新数据
      const { id } = await params
      const [userData, transData] = await Promise.all([
        getUserDetail(id),
        getTransactions({ userId: id })
      ])
      setUser(userData)
      setTransactions(transData)
    } else {
      setError(result.error || '充值失败')
    }
    setRecharging(false)
  }

  const handleResetPassword = async () => {
    if (!user) return
    if (!newPassword || newPassword.length < 6) {
      setError('密码至少6位')
      return
    }

    setResetting(true)
    setError('')
    setMessage('')

    const result = await adminResetPassword(user._id.toString(), newPassword)
    if (result.success) {
      setMessage('密码已重置')
      setNewPassword('')
    } else {
      setError(result.error || '重置失败')
    }
    setResetting(false)
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  if (!user) {
    return <div className="text-center py-8">用户不存在</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{user.username}</h1>
          <p className="text-muted-foreground">用户管理</p>
        </div>
      </div>

      {error && <div className="text-sm text-red-500 bg-red-50 p-3 rounded">{error}</div>}
      {message && <div className="text-sm text-green-600 bg-green-50 p-3 rounded">{message}</div>}

      <div className="grid gap-6 md:grid-cols-2">
        {/* 用户信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">用户名:</span>
                <span className="ml-2 font-medium">{user.username}</span>
              </div>
              <div>
                <span className="text-muted-foreground">角色:</span>
                <span className="ml-2">{user.role === 'admin' ? '管理员' : '用户'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">余额:</span>
                <span className="ml-2 font-medium">{formatBalance(user.balance)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">账号:</span>
                <span className="ml-2">{user.currentAccounts}/{user.maxAccounts}</span>
              </div>
              <div>
                <span className="text-muted-foreground">累计充值:</span>
                <span className="ml-2">{formatBalance(user.totalRecharge)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">累计消费:</span>
                <span className="ml-2">{formatBalance(user.totalConsumed)}</span>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <Label>状态</Label>
              <Select
                value={user.status}
                onValueChange={(v) => handleStatusChange(v as 'active' | 'suspended')}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="suspended">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 充值 */}
        <Card>
          <CardHeader>
            <CardTitle>充值</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>充值金额 (元)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                placeholder="输入金额"
                disabled={recharging}
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input
                value={rechargeNote}
                onChange={(e) => setRechargeNote(e.target.value)}
                placeholder="可选"
                disabled={recharging}
              />
            </div>
            <Button onClick={handleRecharge} disabled={recharging || !rechargeAmount}>
              {recharging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              充值
            </Button>
          </CardContent>
        </Card>

        {/* 重置密码 */}
        <Card>
          <CardHeader>
            <CardTitle>重置密码</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少6位"
                disabled={resetting}
              />
            </div>
            <Button onClick={handleResetPassword} disabled={resetting || !newPassword}>
              {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              重置密码
            </Button>
          </CardContent>
        </Card>

        {/* 交易记录 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>交易记录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactions.map((trans) => (
                <div key={trans._id.toString()} className="flex items-center justify-between p-3 border rounded text-sm">
                  <div>
                    <span className={trans.type === 'recharge' ? 'text-green-600' : 'text-red-600'}>
                      {trans.type === 'recharge' ? '+' : ''}{formatBalance(trans.amount)}
                    </span>
                    <span className="ml-2 text-muted-foreground">{trans.description}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {new Date(trans.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-center text-muted-foreground py-4">暂无记录</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
