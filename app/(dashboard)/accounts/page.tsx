import Link from 'next/link'
import Image from 'next/image'
import { Plus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AccountCard } from '@/components/accounts/account-card'
import { getAccounts } from '@/actions/account'
import { getLinkedAuthors } from '@/actions/note'

export default async function AccountsPage() {
  const [accounts, linkedAuthorsResult] = await Promise.all([
    getAccounts(),
    getLinkedAuthors(),
  ])

  const linkedAuthors = linkedAuthorsResult.success ? linkedAuthorsResult.authors || [] : []
  // 过滤掉已经有完整账号的关联作者
  const pendingAuthors = linkedAuthors.filter(a => a.status === 'pending' && !a.accountId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">账号管理</h2>
          <p className="text-muted-foreground">
            管理小红书聚光平台账号
          </p>
        </div>
        <Link href="/accounts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            添加账号
          </Button>
        </Link>
      </div>

      {/* 待完善的关联作者 */}
      {pendingAuthors.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-medium text-amber-700">待完善账号</h3>
            <Badge variant="secondary" className="text-xs">{pendingAuthors.length}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pendingAuthors.map((author) => (
              <Link key={author._id} href={`/accounts/new?userId=${author.userId}&nickname=${encodeURIComponent(author.nickname)}&avatar=${encodeURIComponent(author.avatar)}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer border-amber-200 bg-amber-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {author.avatar && (
                        <Image
                          src={author.avatar}
                          alt={author.nickname}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{author.nickname}</p>
                        <p className="text-xs text-muted-foreground">
                          关联于 {new Date(author.linkedAt).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        待添加Cookie
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 完整账号列表 */}
      {accounts.length === 0 && pendingAuthors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">暂无账号</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            添加小红书账号开始自动投放
          </p>
          <Link href="/accounts/new">
            <Button>添加第一个账号</Button>
          </Link>
        </div>
      ) : accounts.length > 0 ? (
        <div className="space-y-3">
          {pendingAuthors.length > 0 && (
            <h3 className="text-sm font-medium text-muted-foreground">完整账号</h3>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <AccountCard key={account._id.toString()} account={account} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
