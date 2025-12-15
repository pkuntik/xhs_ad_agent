'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Copy, Check, ExternalLink, Edit2, Save, ArrowLeft } from 'lucide-react'
import { getWorkById, updateWorkContent, bindPublishedNote } from '@/actions/work'
import type { Work } from '@/types/work'

const statusMap = {
  unused: { label: '未使用', variant: 'secondary' as const },
  scanned: { label: '已扫码', variant: 'outline' as const },
  published: { label: '已发布', variant: 'success' as const },
  promoting: { label: '投放中', variant: 'default' as const },
  paused: { label: '已暂停', variant: 'warning' as const },
  archived: { label: '已归档', variant: 'outline' as const },
}

export default function WorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [work, setWork] = useState<Work | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // 编辑相关状态
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [editedContent, setEditedContent] = useState('')
  const [editedTopics, setEditedTopics] = useState('')

  // 绑定笔记相关状态
  const [noteUrl, setNoteUrl] = useState('')
  const [binding, setBinding] = useState(false)

  useEffect(() => {
    async function loadWork() {
      try {
        const resolvedParams = await params
        const data = await getWorkById(resolvedParams.id)
        if (data) {
          setWork(data)
          setEditedTitle(data.title)
          setEditedContent(data.content || data.draftContent?.content?.body || '')
          setEditedTopics(data.tags?.join(' ') || data.draftContent?.topics?.tags.join(' ') || '')
          setNoteUrl(data.noteUrl || '')
        } else {
          setError('作品不存在')
        }
      } catch (err) {
        setError('加载失败')
      } finally {
        setLoading(false)
      }
    }
    loadWork()
  }, [params])

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave() {
    if (!work) return
    setSaving(true)
    setError('')

    try {
      const result = await updateWorkContent(work._id.toString(), {
        title: editedTitle,
        content: editedContent,
        tags: editedTopics.split(/\s+/).filter(Boolean),
      })

      if (result.success) {
        setWork({
          ...work,
          title: editedTitle,
          content: editedContent,
          tags: editedTopics.split(/\s+/).filter(Boolean),
        })
        setIsEditing(false)
      } else {
        setError(result.error || '保存失败')
      }
    } catch (err) {
      setError('保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleBindNote() {
    if (!work || !noteUrl.trim()) return
    setBinding(true)
    setError('')

    try {
      const result = await bindPublishedNote(work.publishCode, { noteUrl: noteUrl.trim() })

      if (result.success) {
        setWork({ ...work, noteUrl: noteUrl.trim(), status: 'published' })
      } else {
        setError(result.error || '绑定失败')
      }
    } catch (err) {
      setError('绑定失败')
    } finally {
      setBinding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!work) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{error || '作品不存在'}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          返回
        </Button>
      </div>
    )
  }

  const status = statusMap[work.status] || statusMap.unused
  const publishUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${work.publishCode}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{work.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={status.variant}>{status.label}</Badge>
              <span className="text-sm text-muted-foreground">
                发布码: {work.publishCode}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                保存
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit2 className="mr-2 h-4 w-4" />
              编辑
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：内容区 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 标题 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">标题</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="输入标题"
                />
              ) : (
                <p className="font-medium">{editedTitle || work.title}</p>
              )}
            </CardContent>
          </Card>

          {/* 正文 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">正文内容</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  placeholder="输入正文内容"
                  rows={10}
                />
              ) : (
                <div className="whitespace-pre-wrap text-sm">
                  {editedContent || work.content || work.draftContent?.content?.body || '暂无内容'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 话题标签 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">话题标签</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Input
                  value={editedTopics}
                  onChange={(e) => setEditedTopics(e.target.value)}
                  placeholder="输入话题标签，空格分隔"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(editedTopics || work.tags?.join(' ') || '').split(/\s+/).filter(Boolean).map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 封面规划 */}
          {work.draftContent?.cover && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">封面规划</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 显示封面图片 */}
                {work.draftContent.cover.imageUrl && (
                  <div className="relative aspect-[3/4] max-w-sm overflow-hidden rounded-lg border">
                    <img
                      src={work.draftContent.cover.imageUrl}
                      alt="封面图片"
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  <p><strong>类型：</strong>{work.draftContent.cover.type}</p>
                  <p><strong>主视觉：</strong>{work.draftContent.cover.mainVisual}</p>
                  <p><strong>文案：</strong>{work.draftContent.cover.copywriting}</p>
                  <p><strong>配色：</strong>{work.draftContent.cover.colorScheme}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 配图规划 */}
          {work.draftContent?.images && work.draftContent.images.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">配图 ({work.draftContent.images.length} 张)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {work.draftContent.images.map((img, i) => (
                  <div key={i} className="p-3 bg-muted/50 rounded-md space-y-3">
                    {/* 显示配图 */}
                    {img.imageUrl && (
                      <div className="relative aspect-[3/4] max-w-sm overflow-hidden rounded-lg border">
                        <img
                          src={img.imageUrl}
                          alt={`配图 ${img.index || i + 1}`}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    )}
                    <div className="text-sm">
                      <p className="font-medium">图 {img.index || i + 1}: {img.type}</p>
                      <p className="text-muted-foreground">{img.content}</p>
                      {img.overlay && <p className="text-muted-foreground">文字：{img.overlay}</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：发布码和状态 */}
        <div className="space-y-4">
          {/* 发布二维码 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">发布二维码</CardTitle>
              <CardDescription>扫码在手机上发布到小红书</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-lg">
                <QRCodeSVG value={publishUrl} size={180} />
              </div>
              <div className="w-full space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={publishUrl} readOnly className="text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(publishUrl)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(publishUrl, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  在浏览器中打开
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 绑定笔记链接 */}
          {work.status !== 'published' && work.status !== 'promoting' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">绑定笔记链接</CardTitle>
                <CardDescription>发布后填写笔记链接完成绑定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>笔记链接</Label>
                  <Input
                    value={noteUrl}
                    onChange={(e) => setNoteUrl(e.target.value)}
                    placeholder="https://www.xiaohongshu.com/explore/..."
                  />
                </div>
                <Button
                  className="w-full"
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
              </CardContent>
            </Card>
          )}

          {/* 已绑定信息 */}
          {work.noteUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">笔记信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {work.noteId && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">笔记 ID：</span>
                    {work.noteId}
                  </div>
                )}
                <div className="text-sm break-all">
                  <span className="text-muted-foreground">笔记链接：</span>
                  <a
                    href={work.noteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {work.noteUrl}
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 投放数据 */}
          {(work.status === 'published' || work.status === 'promoting') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">投放数据</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">总消耗</p>
                    <p className="text-lg font-medium">{work.totalSpent.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">曝光量</p>
                    <p className="text-lg font-medium">{work.totalImpressions}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">点击量</p>
                    <p className="text-lg font-medium">{work.totalClicks}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">咨询数</p>
                    <p className="text-lg font-medium">{work.totalLeads}</p>
                  </div>
                </div>
                {work.totalLeads > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-muted-foreground text-sm">平均咨询成本</p>
                    <p className="text-xl font-medium text-primary">
                      ¥{work.avgCostPerLead.toFixed(2)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
