'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createAccount } from '@/actions/account'

export default function NewAccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      cookie: formData.get('cookie') as string,
      dailyBudget: Number(formData.get('dailyBudget')) || 5000,
      defaultBidAmount: Number(formData.get('defaultBidAmount')) || 30,
    }

    try {
      const result = await createAccount(data)
      if (result.success) {
        router.push('/accounts')
        router.refresh()
      } else {
        setError(result.error || '添加失败')
      }
    } catch (err) {
      setError('添加失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">添加账号</h2>
        <p className="text-muted-foreground">
          添加小红书聚光平台账号
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>账号信息</CardTitle>
          <CardDescription>
            请填写账号名称和登录 Cookie
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">账号名称</Label>
              <Input
                id="name"
                name="name"
                placeholder="例如：主账号"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cookie">Cookie</Label>
              <Textarea
                id="cookie"
                name="cookie"
                placeholder="请粘贴小红书聚光平台的 Cookie"
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                登录聚光平台后，按 F12 打开开发者工具，在 Network 标签中复制 Cookie
              </p>
            </div>

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
                onClick={() => router.back()}
              >
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '添加中...' : '添加账号'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
