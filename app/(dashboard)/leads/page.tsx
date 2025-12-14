import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">咨询线索</h2>
        <p className="text-muted-foreground">
          管理私信咨询线索
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">线索列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-12">
            暂无咨询线索
            <p className="text-sm mt-2">
              线索将在投放产生咨询后自动同步
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
