import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Settings, FileText, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AutoManageToggle } from '@/components/accounts/auto-manage-toggle'
import { getAccountById, getAccountStats } from '@/actions/account'
import { getWorks } from '@/actions/work'
import { getCampaigns } from '@/actions/campaign'
import { formatMoney, formatDateTime } from '@/lib/utils'

interface AccountDetailPageProps {
  params: Promise<{ id: string }>
}

const statusMap = {
  pending: { label: '待完善', variant: 'outline' as const },
  active: { label: '正常', variant: 'success' as const },
  inactive: { label: '已停用', variant: 'secondary' as const },
  suspended: { label: '已暂停', variant: 'warning' as const },
  cookie_expired: { label: 'Cookie过期', variant: 'destructive' as const },
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const { id } = await params
  const [account, stats, works, campaigns] = await Promise.all([
    getAccountById(id),
    getAccountStats(id),
    getWorks(id),
    getCampaigns({ accountId: id }),
  ])

  if (!account) {
    notFound()
  }

  const status = statusMap[account.status] || statusMap.inactive

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/accounts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-bold tracking-tight">
                {account.name}
              </h2>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-muted-foreground">
              最后同步: {account.lastSyncAt ? formatDateTime(account.lastSyncAt) : '从未同步'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <AutoManageToggle
            accountId={account._id.toString()}
            initialEnabled={account.autoManaged ?? false}
          />
          <Link href={`/accounts/${id}/settings`}>
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              设置
            </Button>
          </Link>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              账户余额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(account.balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              作品数量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalWorks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              活跃计划
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.activeCampaigns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              总咨询数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalLeads}</p>
          </CardContent>
        </Card>
      </div>

      {/* 详情标签页 */}
      <Tabs defaultValue="works">
        <TabsList>
          <TabsTrigger value="works">
            <FileText className="mr-2 h-4 w-4" />
            作品
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            <Megaphone className="mr-2 h-4 w-4" />
            投放计划
          </TabsTrigger>
        </TabsList>

        <TabsContent value="works" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">关联作品</CardTitle>
              <Link href={`/works/new?accountId=${id}`}>
                <Button size="sm">绑定作品</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {works.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  暂无作品
                </p>
              ) : (
                <div className="space-y-2">
                  {works.map((work) => (
                    <Link
                      key={work._id.toString()}
                      href={`/works/${work._id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium">{work.title}</p>
                        <p className="text-sm text-muted-foreground">
                          笔记ID: {work.noteId}
                        </p>
                      </div>
                      <Badge
                        variant={
                          work.status === 'promoting'
                            ? 'default'
                            : work.status === 'published'
                              ? 'success'
                              : 'secondary'
                        }
                      >
                        {work.status === 'promoting'
                          ? '投放中'
                          : work.status === 'published'
                            ? '已发布'
                            : work.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">投放计划</CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  暂无投放计划
                </p>
              ) : (
                <div className="space-y-2">
                  {campaigns.map((campaign) => (
                    <Link
                      key={campaign._id.toString()}
                      href={`/campaigns/${campaign._id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">
                          预算: {formatMoney(campaign.budget)} | 出价:{' '}
                          {formatMoney(campaign.bidAmount)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          campaign.status === 'active'
                            ? 'success'
                            : campaign.status === 'paused'
                              ? 'warning'
                              : 'secondary'
                        }
                      >
                        {campaign.status === 'active'
                          ? '投放中'
                          : campaign.status === 'paused'
                            ? '已暂停'
                            : campaign.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
