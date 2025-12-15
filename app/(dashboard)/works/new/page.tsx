'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { createWork } from '@/actions/work'
import { getAccounts } from '@/actions/account'
import type { AccountListItem } from '@/types/account'

function NewWorkForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultAccountId = searchParams.get('accountId')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState<AccountListItem[]>([])

  useEffect(() => {
    getAccounts().then(setAccounts)
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const data = {
      accountId: formData.get('accountId') as string,
      noteId: formData.get('noteId') as string,
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      coverUrl: formData.get('coverUrl') as string,
    }

    if (!data.accountId) {
      setError('请选择账号')
      setLoading(false)
      return
    }

    try {
      const result = await createWork(data)
      if (result.success) {
        router.push('/works')
        router.refresh()
      } else {
        setError(result.error || '绑定失败')
      }
    } catch (err) {
      setError('绑定失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>作品信息</CardTitle>
        <CardDescription>
          请填写笔记 ID 和相关信息
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountId">选择账号</Label>
            <select
              id="accountId"
              name="accountId"
              defaultValue={defaultAccountId || ''}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            >
              <option value="">请选择账号</option>
              {accounts.map((account) => (
                <option key={account._id.toString()} value={account._id.toString()}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="noteId">笔记 ID</Label>
            <Input
              id="noteId"
              name="noteId"
              placeholder="例如：6xxxxxxxxxxxxxxxxx"
              required
            />
            <p className="text-xs text-muted-foreground">
              在笔记链接中获取，格式如 xhslink.com/xxx 或笔记详情页 URL 中的 ID
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">笔记标题</Label>
            <Input
              id="title"
              name="title"
              placeholder="笔记标题"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">笔记内容（可选）</Label>
            <Textarea
              id="content"
              name="content"
              placeholder="笔记正文内容"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverUrl">封面图 URL（可选）</Label>
            <Input
              id="coverUrl"
              name="coverUrl"
              placeholder="https://..."
            />
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
              {loading ? '绑定中...' : '绑定作品'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function FormLoading() {
  return (
    <Card>
      <CardContent className="py-8">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>加载中...</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function NewWorkPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">绑定作品</h2>
        <p className="text-muted-foreground">
          绑定已发布的小红书笔记
        </p>
      </div>

      <Suspense fallback={<FormLoading />}>
        <NewWorkForm />
      </Suspense>
    </div>
  )
}
