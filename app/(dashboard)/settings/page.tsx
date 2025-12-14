import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">系统设置</h2>
        <p className="text-muted-foreground">
          配置系统参数
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">默认投放配置</CardTitle>
            <CardDescription>
              新建投放计划时的默认参数
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>默认预算（元）</Label>
                <Input type="number" defaultValue={2000} />
              </div>
              <div className="space-y-2">
                <Label>默认出价（元）</Label>
                <Input type="number" defaultValue={30} />
              </div>
            </div>
            <Button>保存</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">效果检测阈值</CardTitle>
            <CardDescription>
              自动投放效果判断标准
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>最低检查消耗（元）</Label>
                <Input type="number" defaultValue={100} />
                <p className="text-xs text-muted-foreground">
                  消耗达到此金额后开始检查效果
                </p>
              </div>
              <div className="space-y-2">
                <Label>最大咨询成本（元）</Label>
                <Input type="number" defaultValue={50} />
                <p className="text-xs text-muted-foreground">
                  超过此成本视为效果不佳
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>最大失败重试次数</Label>
              <Input type="number" defaultValue={3} />
              <p className="text-xs text-muted-foreground">
                连续失败超过此次数将切换作品
              </p>
            </div>
            <Button>保存</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">定时任务</CardTitle>
            <CardDescription>
              系统自动执行的任务配置
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">效果检查</p>
                  <p className="text-sm text-muted-foreground">
                    每 5 分钟检查一次待处理任务
                  </p>
                </div>
                <span className="text-sm text-green-600">运行中</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
