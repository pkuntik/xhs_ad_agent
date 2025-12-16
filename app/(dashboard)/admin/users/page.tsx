import { Suspense } from 'react'
import Link from 'next/link'
import { getUsers } from '@/actions/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBalance } from '@/types/pricing'
import type { User } from '@/types/user'
import { Plus } from 'lucide-react'

async function UserList() {
  const users = await getUsers()

  return (
    <div className="space-y-4">
      {users.map((user: User) => (
        <Card key={user._id.toString()}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.username}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {user.role === 'admin' ? '管理员' : '用户'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {user.status === 'active' ? '正常' : '已禁用'}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  余额: <span className="font-medium text-foreground">{formatBalance(user.balance)}</span>
                  {' · '}
                  账号: {user.currentAccounts}/{user.maxAccounts}
                  {user.email && <> · {user.email}</>}
                </div>
              </div>
              <Link href={`/admin/users/${user._id.toString()}`}>
                <Button variant="outline" size="sm">
                  管理
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
      {users.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          暂无用户
        </div>
      )}
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-muted-foreground">管理系统用户和开户</p>
        </div>
        <Link href="/admin/users/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            开户
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div>加载中...</div>}>
        <UserList />
      </Suspense>
    </div>
  )
}
