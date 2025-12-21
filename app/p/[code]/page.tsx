'use client'

import { useState, useEffect, useCallback } from 'react'
import Script from 'next/script'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, CheckCircle, Link as LinkIcon, Plus, ExternalLink, Smartphone } from 'lucide-react'
import { getPublishConfig, markWorkScanned, bindPublishedNote } from '@/actions/work'
import type { Work, Publication } from '@/types/work'
import type { VerifyConfig } from '@/lib/xhs/signature'

declare global {
  interface Window {
    xhs: {
      share: (config: {
        shareInfo: {
          type: 'normal' | 'video'
          title: string
          content: string
          images?: string[]
        }
        verifyConfig: {
          appKey: string
          nonce: string
          timestamp: number
          signature: string
        }
        success?: () => void
        fail?: (err: unknown) => void
      }) => void
    }
  }
}

const statusMap = {
  unused: { label: '待发布', color: 'bg-yellow-100 text-yellow-800' },
  scanned: { label: '已扫码', color: 'bg-blue-100 text-blue-800' },
  published: { label: '已发布', color: 'bg-green-100 text-green-800' },
  promoting: { label: '投放中', color: 'bg-purple-100 text-purple-800' },
  paused: { label: '已暂停', color: 'bg-gray-100 text-gray-800' },
  archived: { label: '已归档', color: 'bg-gray-100 text-gray-800' },
}

export default function PublishPage({ params }: { params: Promise<{ code: string }> }) {
  const [work, setWork] = useState<Work | null>(null)
  const [verifyConfig, setVerifyConfig] = useState<VerifyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [isMobile, setIsMobile] = useState(true)  // 默认 true 避免闪烁

  // 绑定笔记相关状态
  const [noteUrl, setNoteUrl] = useState('')
  const [binding, setBinding] = useState(false)
  const [publications, setPublications] = useState<Publication[]>([])
  const [showAddMore, setShowAddMore] = useState(false)  // 已发布后是否显示添加更多

  const loadWork = useCallback(async () => {
    try {
      const resolvedParams = await params
      const result = await getPublishConfig(resolvedParams.code)

      if (!result.success || !result.work) {
        setError(result.error || '作品不存在')
        return
      }

      setWork(result.work)
      setVerifyConfig(result.verifyConfig || null)
      setPublications(result.work.publications || [])

      if (result.work.status === 'published' || result.work.status === 'promoting') {
        setPublished(true)
      }

      // 标记已扫码
      if (result.work.status === 'unused') {
        await markWorkScanned(resolvedParams.code)
      }
    } catch (err) {
      setError('加载失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    loadWork()
  }, [loadWork])

  // 检测是否为移动端
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
      setIsMobile(isMobileDevice)
    }
    checkMobile()
  }, [])

  async function handlePublish() {
    if (!work || !verifyConfig || !sdkLoaded) return

    setPublishing(true)
    setError('')

    try {
      const title = work.draftContent?.title?.text || work.title
      const content = work.draftContent?.content?.body || work.content || ''

      // 收集所有图片 URL（封面 + 配图）
      const coverImage = work.draftContent?.cover?.imageUrl
      const contentImages = work.draftContent?.images?.map(img => img.imageUrl).filter((url): url is string => !!url) || []
      let images = [
        ...(coverImage ? [coverImage] : []),
        ...contentImages
      ]

      // 如果没有实际图片 URL，为每张规划的图生成占位图
      if (images.length === 0) {
        const allImages = work.draftContent?.images || []
        const hasCover = !!work.draftContent?.cover

        if (hasCover || allImages.length > 0) {
          // 生成封面占位图
          if (hasCover) {
            images.push(`${window.location.origin}/api/image/placeholder?title=${encodeURIComponent(work.draftContent!.cover!.overlay || '封面')}&color=0`)
          }
          // 为每张规划图生成占位图
          allImages.forEach((img, i) => {
            images.push(`${window.location.origin}/api/image/placeholder?title=${encodeURIComponent(img.content || `配图${i + 1}`)}&color=${(i + 1) % 6}`)
          })
        } else {
          // 完全没有图片规划，生成单张封面占位图
          const colorIndex = Math.floor(Math.random() * 6)
          images = [`${window.location.origin}/api/image/placeholder?title=${encodeURIComponent(title)}&color=${colorIndex}`]
        }
      }

      console.log('images', images)

      window.xhs.share({
        shareInfo: {
          type: 'normal',
          title,
          content,
          images,
        },
        verifyConfig: {
          appKey: verifyConfig.appKey,
          nonce: verifyConfig.nonce,
          timestamp: verifyConfig.timestamp,
          signature: verifyConfig.signature,
        },
        success: () => {
          setPublished(true)
          setPublishing(false)
        },
        fail: (err) => {
          console.error('发布失败:', err)
          setError('唤起小红书失败，请确保已安装小红书 App')
          setPublishing(false)
        },
      })

      // 唤起后延迟重置按钮状态（因为用户切换到小红书 App 后回调可能不会触发）
      setTimeout(() => {
        setPublished(true)
        setPublishing(false)
      }, 2000)
    } catch (err) {
      setError('发布失败，请重试')
      setPublishing(false)
    }
  }

  async function handleBindNote() {
    if (!work || !noteUrl.trim()) return

    setBinding(true)
    setError('')

    try {
      const result = await bindPublishedNote(work.publishCode, { noteUrl: noteUrl.trim() })

      if (result.success) {
        // 添加到本地 publications 列表
        const newPublication: Publication = {
          noteUrl: noteUrl.trim(),
          publishedAt: new Date(),
        }
        setPublications([...publications, newPublication])
        setNoteUrl('')  // 清空输入框以便添加更多
        setShowAddMore(false)
        setWork({ ...work, status: 'published' })
      } else {
        setError(result.error || '绑定失败')
      }
    } catch (err) {
      setError('绑定失败，请重试')
    } finally {
      setBinding(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-pink-500" />
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!work) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-red-500">{error || '作品不存在或已过期'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const status = statusMap[work.status] || statusMap.unused
  const title = work.draftContent?.title?.text || work.title
  const content = work.draftContent?.content?.body || work.content || ''
  const topics = work.draftContent?.topics?.tags || work.tags || []

  return (
    <>
      <Script
        src="https://fe-static.xhscdn.com/biz-static/goten/xhs-1.0.1.js"
        onLoad={() => setSdkLoaded(true)}
      />

      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
        {/* 头部 */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">XHS</span>
              </div>
              <span className="font-medium">小红书发布</span>
            </div>
            <Badge className={status.color}>{status.label}</Badge>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* 内容预览 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 封面和配图预览 */}
              {(() => {
                const cover = work.draftContent?.cover
                const allImages = work.draftContent?.images || []
                const hasCover = !!cover
                const hasImages = allImages.length > 0

                // 如果没有任何规划的图片
                if (!hasCover && !hasImages) {
                  return (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">将自动生成封面图：</p>
                      <div className="relative aspect-[3/4] max-w-[200px] bg-gray-100 rounded-lg overflow-hidden">
                        <Image
                          src={`/api/image/placeholder?title=${encodeURIComponent(title)}&color=0`}
                          alt="自动生成封面"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    </div>
                  )
                }

                // 统计未生成的图片数量
                const coverNotGenerated = hasCover && !cover?.imageUrl
                const imagesNotGenerated = allImages.filter(img => !img.imageUrl).length
                const totalNotGenerated = (coverNotGenerated ? 1 : 0) + imagesNotGenerated

                return (
                  <div className="space-y-2">
                    {totalNotGenerated > 0 && (
                      <p className="text-xs text-gray-500">
                        还有 {totalNotGenerated} 张图片待生成
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {/* 封面 */}
                      {hasCover && (
                        <div className="relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
                          <div className="absolute top-1 left-1 z-10 px-1.5 py-0.5 bg-pink-500 text-white text-xs rounded">
                            封面
                          </div>
                          <Image
                            src={cover?.imageUrl || `/api/image/placeholder?title=${encodeURIComponent(cover?.overlay || '封面')}&color=0`}
                            alt="封面"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      )}
                      {/* 配图 */}
                      {allImages.map((img, i) => (
                        <div key={i} className="relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
                          <Image
                            src={img.imageUrl || `/api/image/placeholder?title=${encodeURIComponent(img.content || `配图${i + 1}`)}&color=${(i + 1) % 6}`}
                            alt={`配图 ${i + 1}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* 正文预览 */}
              <div className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6">
                {content}
              </div>

              {/* 话题标签 */}
              {topics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {topics.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-pink-50 text-pink-600 rounded-full text-xs"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 封面规划提示 */}
              {work.draftContent?.cover && (
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  <strong>封面：</strong>{work.draftContent.cover.overlay}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 发布按钮 - 始终显示，允许多次发布 */}
          <>
            {!isMobile && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-orange-700 mb-2">
                    <Smartphone className="h-5 w-5" />
                    <span className="font-medium">请在手机上打开此页面</span>
                  </div>
                  <p className="text-sm text-orange-600">
                    小红书 SDK 仅支持移动端，请使用手机扫码访问此页面后发布
                  </p>
                </CardContent>
              </Card>
            )}
            <Button
              className="w-full h-12 text-lg bg-pink-500 hover:bg-pink-600"
              onClick={handlePublish}
              disabled={publishing || !sdkLoaded || !isMobile}
            >
              {publishing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  正在唤起小红书...
                </>
              ) : !isMobile ? (
                <>
                  <Smartphone className="mr-2 h-5 w-5" />
                  请在手机上打开
                </>
              ) : !sdkLoaded ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  加载中...
                </>
              ) : published ? (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  再次发布到小红书
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  发布到小红书
                </>
              )}
            </Button>
          </>

          {/* 发布成功提示 */}
          {published && publications.length === 0 && !showAddMore && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-700 mb-3">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">已唤起小红书 App</span>
                </div>
                <p className="text-sm text-green-600 mb-4">
                  请在小红书 App 中完成发布，然后回到这里填写笔记链接
                </p>
              </CardContent>
            </Card>
          )}

          {/* 绑定笔记链接 */}
          {(published || work.status === 'scanned' || showAddMore) && (publications.length === 0 || showAddMore) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  {publications.length > 0 ? '添加更多笔记链接' : '绑定笔记链接'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">发布后的笔记链接</Label>
                  <Input
                    value={noteUrl}
                    onChange={(e) => setNoteUrl(e.target.value)}
                    placeholder="https://www.xiaohongshu.com/explore/..."
                    className="text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    在小红书 App 中打开笔记，点击分享 → 复制链接
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={handleBindNote}
                    disabled={binding || !noteUrl.trim()}
                  >
                    {binding ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        绑定中...
                      </>
                    ) : (
                      '确认绑定'
                    )}
                  </Button>
                  {showAddMore && (
                    <Button
                      variant="outline"
                      onClick={() => setShowAddMore(false)}
                    >
                      取消
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 已绑定的笔记列表 */}
          {publications.length > 0 && !showAddMore && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  已绑定笔记 ({publications.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {publications.map((pub, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <a
                        href={pub.noteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-pink-600 hover:text-pink-700 font-medium"
                      >
                        <ExternalLink className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">笔记 {index + 1}</span>
                      </a>
                      <p className="text-xs text-muted-foreground mt-1">
                        绑定于 {new Date(pub.publishedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowAddMore(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  添加更多笔记
                </Button>
              </CardContent>
            </Card>
          )}
        </main>

        {/* 底部说明 */}
        <footer className="max-w-lg mx-auto px-4 py-6 text-center text-xs text-gray-400">
          <p>点击发布按钮将唤起小红书 App</p>
          <p>请确保已安装小红书客户端</p>
        </footer>
      </div>
    </>
  )
}
