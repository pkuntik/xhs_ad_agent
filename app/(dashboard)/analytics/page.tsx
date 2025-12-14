import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">数据分析</h2>
        <p className="text-muted-foreground">
          投放数据分析与 AI 洞察
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">投放趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-12">
              暂无数据
              <p className="text-sm mt-2">
                开始投放后将显示趋势图表
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI 洞察</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-12">
              暂无洞察
              <p className="text-sm mt-2">
                积累足够数据后 AI 将生成优化建议
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
