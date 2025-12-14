import Link from 'next/link'
import { Plus, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCampaigns } from '@/actions/campaign'
import { formatMoney, formatDateTime } from '@/lib/utils'

export default async function CampaignsPage() {
  const campaigns = await getCampaigns()

  const statusMap = {
    pending: { label: '待启动', variant: 'secondary' as const },
    active: { label: '投放中', variant: 'success' as const },
    paused: { label: '已暂停', variant: 'warning' as const },
    completed: { label: '已完成', variant: 'outline' as const },
    failed: { label: '失败', variant: 'destructive' as const },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">投放计划</h2>
          <p className="text-muted-foreground">
            管理广告投放计划
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            筛选
          </Button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">暂无投放计划</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            通过作品创建投放计划
          </p>
          <Link href="/works">
            <Button>前往作品管理</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const status = statusMap[campaign.status] || statusMap.pending

            return (
              <Link
                key={campaign._id.toString()}
                href={`/campaigns/${campaign._id}`}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{campaign.name}</h3>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          创建于 {formatDateTime(campaign.createdAt)} | 第{' '}
                          {campaign.currentBatch} 批次
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          预算: {formatMoney(campaign.budget)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          出价: {formatMoney(campaign.bidAmount)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
