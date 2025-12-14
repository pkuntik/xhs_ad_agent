import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getWorks } from '@/actions/work'
import { formatMoney } from '@/lib/utils'

export default async function WorksPage() {
  const works = await getWorks()

  const statusMap = {
    draft: { label: '草稿', variant: 'secondary' as const },
    published: { label: '已发布', variant: 'success' as const },
    promoting: { label: '投放中', variant: 'default' as const },
    paused: { label: '已暂停', variant: 'warning' as const },
    archived: { label: '已归档', variant: 'outline' as const },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">作品管理</h2>
          <p className="text-muted-foreground">
            管理小红书笔记作品
          </p>
        </div>
        <Link href="/works/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            绑定作品
          </Button>
        </Link>
      </div>

      {works.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">暂无作品</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            绑定小红书笔记开始投放
          </p>
          <Link href="/works/new">
            <Button>绑定第一个作品</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {works.map((work) => {
            const status = statusMap[work.status] || statusMap.draft

            return (
              <Link key={work._id.toString()} href={`/works/${work._id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-base font-medium line-clamp-1">
                      {work.title}
                    </CardTitle>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        笔记ID: {work.noteId}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">总消耗: </span>
                          <span className="font-medium">
                            {formatMoney(work.totalSpent)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">咨询数: </span>
                          <span className="font-medium">{work.totalLeads}</span>
                        </div>
                      </div>
                      {work.totalLeads > 0 && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            平均成本:{' '}
                          </span>
                          <span className="font-medium">
                            {formatMoney(work.avgCostPerLead)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-muted-foreground">
                          效果评分
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            work.performanceScore >= 70
                              ? 'text-green-600'
                              : work.performanceScore >= 40
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}
                        >
                          {work.performanceScore}分
                        </span>
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
