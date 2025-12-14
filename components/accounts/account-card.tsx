import Link from 'next/link'
import { MoreHorizontal, Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AutoManageToggle } from './auto-manage-toggle'
import { formatMoney } from '@/lib/utils'
import type { AccountListItem } from '@/types/account'

interface AccountCardProps {
  account: AccountListItem
}

const statusMap = {
  active: { label: '正常', variant: 'success' as const },
  inactive: { label: '已停用', variant: 'secondary' as const },
  suspended: { label: '已暂停', variant: 'warning' as const },
  cookie_expired: { label: 'Cookie过期', variant: 'destructive' as const },
}

export function AccountCard({ account }: AccountCardProps) {
  const status = statusMap[account.status] || statusMap.inactive

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          <Link
            href={`/accounts/${account._id}`}
            className="hover:text-primary transition-colors"
          >
            {account.name}
          </Link>
        </CardTitle>
        <Badge variant={status.variant}>{status.label}</Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* 余额 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">账户余额</span>
            <span className="text-lg font-semibold">
              {formatMoney(account.balance)}
            </span>
          </div>

          {/* 每日预算 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">每日预算</span>
            <span className="text-sm">{formatMoney(account.dailyBudget)}</span>
          </div>

          {/* 默认出价 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">默认出价</span>
            <span className="text-sm">
              {formatMoney(account.defaultBidAmount)}
            </span>
          </div>

          {/* 分隔线 */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <AutoManageToggle
                accountId={account._id.toString()}
                initialEnabled={account.autoManaged}
              />
              <Link href={`/accounts/${account._id}/settings`}>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
