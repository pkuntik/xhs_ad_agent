'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Heart, MessageCircle, Eye, ImageIcon, Play } from 'lucide-react'
import type { Work } from '@/types/work'

interface WorkCardProps {
  work: Work
}

const statusMap = {
  unused: { label: '未使用', variant: 'secondary' as const, color: 'bg-gray-500' },
  scanned: { label: '已扫码', variant: 'outline' as const, color: 'bg-blue-500' },
  published: { label: '已发布', variant: 'default' as const, color: 'bg-green-500' },
  promoting: { label: '投放中', variant: 'default' as const, color: 'bg-orange-500' },
  paused: { label: '已暂停', variant: 'secondary' as const, color: 'bg-yellow-500' },
  archived: { label: '已归档', variant: 'outline' as const, color: 'bg-gray-400' },
}

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

export function WorkCard({ work }: WorkCardProps) {
  const status = statusMap[work.status] || statusMap.unused

  // 获取封面图：优先从 publications 获取，其次从 draftContent，最后用 coverUrl
  const getCoverImage = (): string | null => {
    // 从已发布笔记获取
    if (work.publications?.length) {
      const firstPub = work.publications[0]
      if (firstPub.noteDetail?.coverImage) {
        return firstPub.noteDetail.coverImage
      }
    }
    // 从 AI 生成的封面获取
    if (work.draftContent?.cover?.imageUrl) {
      return work.draftContent.cover.imageUrl
    }
    // 从 AI 生成的图片获取
    if (work.draftContent?.images?.length) {
      const firstImage = work.draftContent.images.find(img => img.imageUrl)
      if (firstImage?.imageUrl) {
        return firstImage.imageUrl
      }
    }
    // 使用作品封面
    if (work.coverUrl) {
      return work.coverUrl
    }
    return null
  }

  // 聚合笔记数据
  const getAggregatedStats = () => {
    if (!work.publications?.length) {
      return { likes: 0, comments: 0, impressions: 0, hasData: false }
    }

    let totalLikes = 0
    let totalComments = 0
    let totalImpressions = 0
    let hasData = false

    for (const pub of work.publications) {
      if (pub.snapshots?.length) {
        const latest = pub.snapshots[pub.snapshots.length - 1]
        totalLikes += latest.likes || 0
        totalComments += latest.comments || 0
        totalImpressions += latest.impressions || 0
        hasData = true
      }
    }

    return { likes: totalLikes, comments: totalComments, impressions: totalImpressions, hasData }
  }

  // 获取作者信息
  const getAuthorInfo = () => {
    if (work.publications?.length) {
      const firstPub = work.publications[0]
      if (firstPub.noteDetail) {
        return {
          nickname: firstPub.noteDetail.authorNickname,
          avatar: firstPub.noteDetail.authorAvatar,
        }
      }
    }
    return null
  }

  const coverImage = getCoverImage()
  const stats = getAggregatedStats()
  const author = getAuthorInfo()
  const isVideo = work.type === 'video'
  const publicationsCount = work.publications?.length || 0

  return (
    <Link href={`/works/${work._id}`}>
      <div className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
        {/* 封面图区域 */}
        <div className="relative aspect-[3/4] bg-muted overflow-hidden">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={work.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <ImageIcon className="h-12 w-12 text-gray-400" />
            </div>
          )}

          {/* 视频标识 */}
          {isVideo && (
            <div className="absolute top-2 left-2 bg-black/60 rounded-full p-1.5">
              <Play className="h-3 w-3 text-white fill-white" />
            </div>
          )}

          {/* 状态标签 */}
          <div className="absolute top-2 right-2">
            <Badge
              variant={status.variant}
              className="text-[10px] px-1.5 py-0.5 font-medium shadow-sm"
            >
              {status.label}
            </Badge>
          </div>

          {/* 多发布数量标识 */}
          {publicationsCount > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/60 rounded-full px-2 py-0.5 text-[10px] text-white font-medium">
              {publicationsCount}个笔记
            </div>
          )}

          {/* 渐变遮罩 */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* 内容区域 */}
        <div className="p-3 space-y-2">
          {/* 标题 */}
          <h3 className="text-sm font-medium line-clamp-2 leading-snug text-gray-900">
            {work.title}
          </h3>

          {/* 数据统计 */}
          {stats.hasData && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                <span>{formatNumber(stats.impressions)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                <span>{formatNumber(stats.likes)}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                <span>{formatNumber(stats.comments)}</span>
              </div>
            </div>
          )}

          {/* 作者信息或投放数据 */}
          <div className="flex items-center justify-between">
            {author ? (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {author.avatar && (
                  <Image
                    src={author.avatar}
                    alt={author.nickname}
                    width={16}
                    height={16}
                    className="rounded-full flex-shrink-0"
                  />
                )}
                <span className="text-xs text-gray-500 truncate">
                  {author.nickname}
                </span>
              </div>
            ) : (
              <div className="text-xs text-gray-400">
                暂无发布
              </div>
            )}

            {/* 效果评分 */}
            {work.performanceScore > 0 && (
              <div
                className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  work.performanceScore >= 70
                    ? 'bg-green-100 text-green-700'
                    : work.performanceScore >= 40
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {work.performanceScore}分
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
