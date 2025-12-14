import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccountCard } from '@/components/accounts/account-card'
import { getAccounts } from '@/actions/account'

export default async function AccountsPage() {
  const accounts = await getAccounts()

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

      {accounts.length === 0 ? (
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account._id.toString()} account={account} />
          ))}
        </div>
      )}
    </div>
  )
}
