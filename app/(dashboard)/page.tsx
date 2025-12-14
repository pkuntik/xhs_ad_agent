import { Suspense } from 'react'
import { DollarSign, Eye, MousePointer, MessageSquare } from 'lucide-react'
import { StatsCard } from '@/components/analytics/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAccounts } from '@/actions/account'
import { getActiveCampaigns } from '@/actions/campaign'
import { formatMoney, formatNumber } from '@/lib/utils'

export default async function DashboardPage() {
  const [accounts, activeCampaigns] = await Promise.all([
    getAccounts(),
    getActiveCampaigns(),
  ])

  // 计算汇总数据（实际应从数据库聚合查询）
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)
  const activeAccountsCount = accounts.filter(
    (acc) => acc.status === 'active' && acc.autoManaged
  ).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">仪表盘</h2>
        <p className="text-muted-foreground">
          小红书自动投放系统概览
        </p>
      </div>

      {/* 数据概览 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="今日消耗"
          value={formatMoney(0)}
          description="较昨日"
          change={0}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="今日展现"
          value={formatNumber(0)}
          description="较昨日"
          change={0}
          icon={<Eye className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="今日点击"
          value={formatNumber(0)}
          description="较昨日"
          change={0}
          icon={<MousePointer className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="今日咨询"
          value={formatNumber(0)}
          description="较昨日"
          change={0}
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* 账号状态 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">账号状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">总账号数</span>
                <span className="font-medium">{accounts.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">托管中</span>
                <span className="font-medium">{activeAccountsCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">总余额</span>
                <span className="font-medium">{formatMoney(totalBalance)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 投放状态 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">投放状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">活跃计划</span>
                <span className="font-medium">{activeCampaigns.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">待检查</span>
                <span className="font-medium">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">已暂停</span>
                <span className="font-medium">0</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 最近活动 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">最近活动</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-8">
              暂无活动记录
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 活跃投放列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">活跃投放计划</CardTitle>
        </CardHeader>
        <CardContent>
          {activeCampaigns.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              暂无活跃的投放计划
            </div>
          ) : (
            <div className="space-y-2">
              {activeCampaigns.map((campaign) => (
                <div
                  key={campaign._id.toString()}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-sm text-muted-foreground">
                      预算: {formatMoney(campaign.budget)} | 出价:{' '}
                      {formatMoney(campaign.bidAmount)}
                    </p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    投放中
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
