'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Copy, Check, ExternalLink, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { getWorkById, updateWorkContent, bindPublishedNote, updateWorkImages } from '@/actions/work'
import { fetchAndValidateNote } from '@/actions/note'
import { NoteCard } from '@/components/works/note-card'
import { NoteBindingDialog } from '@/components/works/note-binding-dialog'
import { CoverPlanCard } from '@/components/works/cover-plan-card'
import { ImagePlanCard } from '@/components/works/image-plan-card'
import { ContentCard } from '@/components/works/content-card'
import type { Work, Publication } from '@/types/work'
import type { GenerationResult } from '@/types/creation'
import type { NoteDetail, CachedNoteDetail, NoteSnapshot } from '@/types/note'

// 移除 draftContent 中的 base64 图片数据，避免 Server Action body 超限
function stripBase64FromDraftContent(draft: GenerationResult | null | undefined): GenerationResult | undefined {
  if (!draft) return undefined

  const isBase64 = (url?: string) => url?.startsWith('data:')

  return {
    ...draft,
    cover: draft.cover ? {
      ...draft.cover,
      imageUrl: isBase64(draft.cover.imageUrl) ? undefined : draft.cover.imageUrl,
    } : undefined,
    images: draft.images?.map(img => ({
      ...img,
      imageUrl: isBase64(img.imageUrl) ? undefined : img.imageUrl,
    })),
  }
}

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

  // 编辑状态
  const [editedTitle, setEditedTitle] = useState('')
  const [editedContent, setEditedContent] = useState('')
  const [editedTopics, setEditedTopics] = useState('')

  // 绑定笔记相关状态
  const [noteUrl, setNoteUrl] = useState('')
  const [binding, setBinding] = useState(false)
  const [showBindingDialog, setShowBindingDialog] = useState(false)
  const [pendingNoteData, setPendingNoteData] = useState<{
    noteId: string
    noteUrl: string
    noteDetail: NoteDetail
    cachedDetail: CachedNoteDetail
    snapshot: NoteSnapshot
    existingAccount?: { _id: string; name: string; visitorUserId: string; status: string }
  } | null>(null)

  // AI 图片生成相关状态
  const [faceSeed, setFaceSeed] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState<GenerationResult | null>(null)

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
          if (data.draftContent) {
            setDraftContent(data.draftContent as GenerationResult)
          }
        } else {
          setError('作品不存在')
        }
      } catch {
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

  // 保存标题
  async function handleSaveTitle(newTitle: string) {
    if (!work) return
    setError('')
    try {
      const result = await updateWorkContent(work._id.toString(), {
        title: newTitle,
        content: editedContent,
        tags: editedTopics.split(/\s+/).filter(Boolean),
        draftContent: stripBase64FromDraftContent(draftContent),
      })
      if (result.success) {
        setWork({ ...work, title: newTitle })
        toast.success('标题已保存')
      } else {
        setError(result.error || '保存失败')
      }
    } catch {
      setError('保存失败')
    }
  }

  // 保存正文
  async function handleSaveContent(newContent: string) {
    if (!work) return
    setError('')
    try {
      const result = await updateWorkContent(work._id.toString(), {
        title: editedTitle,
        content: newContent,
        tags: editedTopics.split(/\s+/).filter(Boolean),
        draftContent: stripBase64FromDraftContent(draftContent),
      })
      if (result.success) {
        setWork({ ...work, content: newContent })
        toast.success('正文已保存')
      } else {
        setError(result.error || '保存失败')
      }
    } catch {
      setError('保存失败')
    }
  }

  // 保存话题标签
  async function handleSaveTopics(newTopics: string) {
    if (!work) return
    setError('')
    const tags = newTopics.split(/\s+/).filter(Boolean)
    try {
      const result = await updateWorkContent(work._id.toString(), {
        title: editedTitle,
        content: editedContent,
        tags,
        draftContent: stripBase64FromDraftContent(draftContent),
      })
      if (result.success) {
        setWork({ ...work, tags })
        toast.success('话题标签已保存')
      } else {
        setError(result.error || '保存失败')
      }
    } catch {
      setError('保存失败')
    }
  }

  // 从小红书链接提取笔记 ID
  function extractNoteId(url: string): string | null {
    const match = url.match(/\/explore\/([a-f0-9]+)/i)
    return match ? match[1] : null
  }

  // 获取笔记详情并显示确认对话框
  async function handleFetchNote() {
    if (!work || !noteUrl.trim()) return

    setBinding(true)
    setError('')

    try {
      const result = await fetchAndValidateNote(noteUrl.trim())

      if (!result.success) {
        setError(result.error || '获取笔记详情失败')
        return
      }

      if (!result.noteId || !result.noteDetail || !result.cachedDetail || !result.snapshot) {
        setError('笔记数据不完整')
        return
      }

      const existingNoteIds = (work.publications || [])
        .map(pub => extractNoteId(pub.noteUrl))
        .filter(Boolean)

      if (existingNoteIds.includes(result.noteId)) {
        toast.error('该笔记已绑定，请勿重复添加')
        return
      }

      setPendingNoteData({
        noteId: result.noteId,
        noteUrl: noteUrl.trim(),
        noteDetail: result.noteDetail,
        cachedDetail: result.cachedDetail,
        snapshot: result.snapshot,
        existingAccount: result.existingAccount,
      })
      setShowBindingDialog(true)
    } catch {
      setError('获取笔记详情失败')
    } finally {
      setBinding(false)
    }
  }

  // 确认绑定
  async function handleConfirmBind(options: {
    noteId: string
    noteUrl: string
    noteDetail: CachedNoteDetail
    snapshot: NoteSnapshot
    accountId?: string
  }) {
    if (!work) return

    setShowBindingDialog(false)
    setBinding(true)
    setError('')

    try {
      const result = await bindPublishedNote(work.publishCode, {
        noteUrl: options.noteUrl,
        noteId: options.noteId,
        accountId: options.accountId,
        noteDetail: options.noteDetail,
        snapshot: options.snapshot,
      })

      if (result.success) {
        const newPublication: Publication = {
          noteId: options.noteId,
          noteUrl: options.noteUrl,
          accountId: options.accountId,
          publishedAt: new Date(),
          noteDetail: options.noteDetail,
          snapshots: [options.snapshot],
          lastSyncAt: new Date(),
        }
        const updatedPublications = [...(work.publications || []), newPublication]
        setWork({
          ...work,
          noteUrl: options.noteUrl,
          publications: updatedPublications,
          status: 'published',
        })
        setNoteUrl('')
        setPendingNoteData(null)
      } else {
        setError(result.error || '绑定失败')
      }
    } catch {
      setError('绑定失败')
    } finally {
      setBinding(false)
    }
  }

  function handleCancelBind() {
    setShowBindingDialog(false)
    setPendingNoteData(null)
  }

  async function refreshWork() {
    if (!work) return
    try {
      const data = await getWorkById(work._id.toString())
      if (data) {
        setWork(data)
      }
    } catch (err) {
      console.error('刷新作品数据失败:', err)
    }
  }

  // 封面图片生成回调
  async function handleCoverImageGenerated(imageUrl: string, imagePrompt: string, chuangkitDesignId?: string) {
    if (!work || !draftContent?.cover) return

    const updatedDraftContent = {
      ...draftContent,
      cover: {
        ...draftContent.cover,
        imageUrl,
        imagePrompt,
        chuangkitDesignId,
      },
    }
    setDraftContent(updatedDraftContent)

    try {
      await updateWorkImages(work._id.toString(), stripBase64FromDraftContent(updatedDraftContent)!)
      setWork({ ...work, draftContent: updatedDraftContent })
    } catch (err) {
      console.error('保存封面图片失败:', err)
    }
  }

  // 配图生成回调
  async function handleImageGenerated(index: number, imageUrl: string, imagePrompt: string, chuangkitDesignId?: string) {
    if (!work || !draftContent?.images) return

    const updatedImages = draftContent.images.map((img, i) =>
      i === index ? { ...img, imageUrl, imagePrompt, chuangkitDesignId } : img
    )
    const updatedDraftContent = {
      ...draftContent,
      images: updatedImages,
    }
    setDraftContent(updatedDraftContent)

    try {
      await updateWorkImages(work._id.toString(), stripBase64FromDraftContent(updatedDraftContent)!)
      setWork({ ...work, draftContent: updatedDraftContent })
    } catch (err) {
      console.error('保存配图失败:', err)
    }
  }

  // 处理内容变更（来自组件）
  function handleContentChange(updates: Partial<GenerationResult>) {
    if (draftContent) {
      setDraftContent({ ...draftContent, ...updates })
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

      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：内容区 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 标题 */}
          <ContentCard
            type="title"
            title="标题"
            value={editedTitle}
            placeholder="输入标题"
            onChange={setEditedTitle}
            onSave={handleSaveTitle}
          />

          {/* 正文 */}
          <ContentCard
            type="content"
            title="正文内容"
            value={editedContent}
            placeholder="输入正文内容"
            onChange={setEditedContent}
            onSave={handleSaveContent}
            multiline
          />

          {/* 话题标签 */}
          <ContentCard
            type="topics"
            title="话题标签"
            value={editedTopics}
            placeholder="输入话题标签，空格分隔"
            onChange={setEditedTopics}
            onSave={handleSaveTopics}
            showTags
          />

          {/* 封面规划 */}
          {draftContent?.cover && (
            <CoverPlanCard
              draftContent={draftContent}
              onContentChange={handleContentChange}
              onImageGenerated={handleCoverImageGenerated}
              faceSeed={faceSeed || undefined}
              onFaceSeedGenerated={setFaceSeed}
              compact
            />
          )}

          {/* 配图规划 */}
          {draftContent?.images && draftContent.images.length > 0 && (
            <ImagePlanCard
              draftContent={draftContent}
              onContentChange={handleContentChange}
              onImageGenerated={handleImageGenerated}
              faceSeed={faceSeed || undefined}
              onFaceSeedGenerated={setFaceSeed}
              compact
            />
          )}

          {/* 评论区运营 */}
          {draftContent?.comments && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">评论区运营</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {draftContent.comments.pinnedComment && (
                  <div className="p-2 bg-yellow-50 rounded">
                    <strong>置顶：</strong>{draftContent.comments.pinnedComment}
                  </div>
                )}
                {draftContent.comments.qaList.map((qa, i) => (
                  <div key={i} className="p-2 bg-muted/50 rounded">
                    <p><strong>Q：</strong>{qa.question}</p>
                    <p><strong>A：</strong>{qa.answer}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 私信模板 */}
          {draftContent?.privateMessage && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">私信模板</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>开场白：</strong>{draftContent.privateMessage.greeting}</p>
                {draftContent.privateMessage.templates.map((tpl, i) => (
                  <div key={i} className="p-2 bg-muted/50 rounded">
                    <p className="text-xs text-muted-foreground">{tpl.scenario}</p>
                    <p>{tpl.message}</p>
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

          {/* 已绑定的笔记链接 */}
          {work.publications && work.publications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">已绑定笔记 ({work.publications.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {work.publications.map((pub, index) => (
                  <NoteCard
                    key={index}
                    publication={pub}
                    workId={work._id.toString()}
                    index={index}
                    onRefresh={refreshWork}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* 绑定笔记链接 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">添加笔记链接</CardTitle>
              <CardDescription>
                {work.publications && work.publications.length > 0
                  ? '可以继续添加更多笔记链接'
                  : '发布后填写笔记链接完成绑定'}
              </CardDescription>
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
                onClick={handleFetchNote}
                disabled={binding || !noteUrl.trim()}
              >
                {binding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    获取笔记信息...
                  </>
                ) : (
                  '添加绑定'
                )}
              </Button>
            </CardContent>
          </Card>

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

      {/* 笔记绑定确认对话框 */}
      {pendingNoteData && (
        <NoteBindingDialog
          open={showBindingDialog}
          onOpenChange={setShowBindingDialog}
          noteUrl={pendingNoteData.noteUrl}
          noteId={pendingNoteData.noteId}
          noteDetail={pendingNoteData.noteDetail}
          cachedDetail={pendingNoteData.cachedDetail}
          snapshot={pendingNoteData.snapshot}
          existingAccount={pendingNoteData.existingAccount}
          onConfirm={handleConfirmBind}
          onCancel={handleCancelBind}
        />
      )}
    </div>
  )
}
