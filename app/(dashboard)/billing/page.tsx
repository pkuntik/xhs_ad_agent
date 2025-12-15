import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getMyBalance, getMyTransactions } from '@/actions/billing'
import { formatBalance } from '@/types/pricing'
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'

async function BalanceCards() {
  const data = await getMyBalance()

  if (!data) {
    return <div>无法加载余额信息</div>
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">当前余额</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatBalance(data.balance)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">累计充值</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{formatBalance(data.totalRecharge)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">累计消费</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{formatBalance(data.totalConsumed)}</div>
        </CardContent>
      </Card>
    </div>
  )
}

async function TransactionList() {
  const transactions = await getMyTransactions()

  return (
    <Card>
      <CardHeader>
        <CardTitle>交易记录</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {transactions.map((trans) => (
            <div key={trans._id.toString()} className="flex items-center justify-between p-3 border rounded text-sm">
              <div className="flex items-center gap-4">
                <span className={`font-medium ${trans.type === 'recharge' ? 'text-green-600' : 'text-red-600'}`}>
                  {trans.type === 'recharge' ? '+' : ''}{formatBalance(trans.amount)}
                </span>
                <span className="text-muted-foreground">{trans.description}</span>
              </div>
              <span className="text-muted-foreground text-xs">
                {new Date(trans.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="text-center text-muted-foreground py-8">暂无记录</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">我的账单</h1>
        <p className="text-muted-foreground">查看余额和消费记录</p>
      </div>

      <Suspense fallback={<div>加载中...</div>}>
        <BalanceCards />
      </Suspense>

      <Suspense fallback={<div>加载中...</div>}>
        <TransactionList />
      </Suspense>
    </div>
  )
}
