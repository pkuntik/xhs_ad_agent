import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getWorks } from '@/actions/work'
import { WorkCard } from '@/components/works/work-card'

export default async function WorksPage() {
  const works = await getWorks()

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">作品管理</h2>
          <p className="text-muted-foreground">
            管理小红书笔记作品 · 共 {works.length} 个作品
          </p>
        </div>
        <Link href="/works/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            创建作品
          </Button>
        </Link>
      </div>

      {works.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gradient-to-br from-pink-100 to-red-100 p-6 mb-4">
            <Plus className="h-10 w-10 text-pink-500" />
          </div>
          <h3 className="text-lg font-medium">暂无作品</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm">
            创建你的第一个作品，开始小红书笔记投放之旅
          </p>
          <Link href="/works/new">
            <Button size="lg" className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600">
              创建第一个作品
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* 作品网格 - 小红书风格 */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {works.map((work) => (
              <WorkCard key={work._id.toString()} work={work} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
