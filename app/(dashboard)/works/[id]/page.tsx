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
import { Loader2, Copy, Check, ExternalLink, Edit2, Save, ArrowLeft, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { getWorkById, updateWorkContent, bindPublishedNote, updateWorkImages } from '@/actions/work'
import { regeneratePlan } from '@/actions/creation'
import { fetchAndValidateNote } from '@/actions/note'
import { ImageGenerator } from '@/components/image/ImageGenerator'
import { NoteCard } from '@/components/works/note-card'
import { NoteBindingDialog } from '@/components/works/note-binding-dialog'
import type { Work, Publication } from '@/types/work'
import type { GenerationResult } from '@/types/creation'
import type { NoteDetail, CachedNoteDetail, NoteSnapshot } from '@/types/note'

// 重新生成封面规划的原因选项
const COVER_REGENERATE_REASONS = [
  { value: 'type', label: '类型不合适' },
  { value: 'mainVisual', label: '主视觉描述不好' },
  { value: 'copywriting', label: '文案不够吸引人' },
  { value: 'colorScheme', label: '配色不协调' },
  { value: 'other', label: '其他' },
]

// 重新生成配图规划的原因选项
const IMAGE_REGENERATE_REASONS = [
  { value: 'type', label: '类型不合适' },
  { value: 'content', label: '内容描述不够具体' },
  { value: 'overlay', label: '文字叠加不好' },
  { value: 'other', label: '其他' },
]

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
  // 封面规划编辑状态
  const [editedCoverType, setEditedCoverType] = useState('')
  const [editedCoverMainVisual, setEditedCoverMainVisual] = useState('')
  const [editedCoverCopywriting, setEditedCoverCopywriting] = useState('')
  const [editedCoverColorScheme, setEditedCoverColorScheme] = useState('')
  // 配图规划编辑状态
  const [editedImages, setEditedImages] = useState<Array<{ type: string; content: string; overlay: string }>>([])
  // 重新生成状态
  const [regeneratingCover, setRegeneratingCover] = useState(false)
  const [regeneratingImageIndex, setRegeneratingImageIndex] = useState<number | null>(null)
  // 重新生成原因选择状态
  const [showCoverRegenDialog, setShowCoverRegenDialog] = useState(false)
  const [showImageRegenDialog, setShowImageRegenDialog] = useState<number | null>(null)
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')

  // 绑定笔记相关状态
  const [noteUrl, setNoteUrl] = useState('')
  const [binding, setBinding] = useState(false)
  // 笔记绑定对话框状态
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
          // 初始化 draftContent 用于图片生成
          if (data.draftContent) {
            setDraftContent(data.draftContent as GenerationResult)
            // 初始化封面编辑状态
            const cover = (data.draftContent as GenerationResult).cover
            if (cover) {
              setEditedCoverType(cover.type || '')
              setEditedCoverMainVisual(cover.mainVisual || '')
              setEditedCoverCopywriting(cover.copywriting || '')
              setEditedCoverColorScheme(cover.colorScheme || '')
            }
            // 初始化配图编辑状态
            const images = (data.draftContent as GenerationResult).images
            if (images && images.length > 0) {
              setEditedImages(images.map(img => ({
                type: img.type || '',
                content: img.content || '',
                overlay: img.overlay || '',
              })))
            }
          }
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
      // 更新 draftContent 中的封面规划和配图规划
      let updatedDraftContent = draftContent
      if (draftContent?.cover) {
        updatedDraftContent = {
          ...draftContent,
          cover: {
            ...draftContent.cover,
            type: editedCoverType,
            mainVisual: editedCoverMainVisual,
            copywriting: editedCoverCopywriting,
            colorScheme: editedCoverColorScheme,
          },
        }
      }
      // 更新配图规划
      if (updatedDraftContent?.images && editedImages.length > 0) {
        updatedDraftContent = {
          ...updatedDraftContent,
          images: updatedDraftContent.images.map((img, i) => ({
            ...img,
            type: editedImages[i]?.type ?? img.type,
            content: editedImages[i]?.content ?? img.content,
            overlay: editedImages[i]?.overlay ?? img.overlay,
          })),
        }
      }

      const result = await updateWorkContent(work._id.toString(), {
        title: editedTitle,
        content: editedContent,
        tags: editedTopics.split(/\s+/).filter(Boolean),
        draftContent: updatedDraftContent || undefined,
      })

      if (result.success) {
        setWork({
          ...work,
          title: editedTitle,
          content: editedContent,
          tags: editedTopics.split(/\s+/).filter(Boolean),
          draftContent: updatedDraftContent || work.draftContent,
        })
        if (updatedDraftContent) {
          setDraftContent(updatedDraftContent)
        }
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

  // 从小红书链接提取笔记 ID
  function extractNoteId(url: string): string | null {
    // 支持格式: https://www.xiaohongshu.com/explore/693e999e000000000d03948c?...
    const match = url.match(/\/explore\/([a-f0-9]+)/i)
    return match ? match[1] : null
  }

  // 第一步：获取笔记详情并显示确认对话框
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

      // 检查是否已存在相同笔记
      const existingNoteIds = (work.publications || [])
        .map(pub => extractNoteId(pub.noteUrl))
        .filter(Boolean)

      if (existingNoteIds.includes(result.noteId)) {
        toast.error('该笔记已绑定，请勿重复添加')
        return
      }

      // 保存数据并显示确认对话框
      setPendingNoteData({
        noteId: result.noteId,
        noteUrl: noteUrl.trim(),
        noteDetail: result.noteDetail,
        cachedDetail: result.cachedDetail,
        snapshot: result.snapshot,
        existingAccount: result.existingAccount,
      })
      setShowBindingDialog(true)
    } catch (err) {
      setError('获取笔记详情失败')
    } finally {
      setBinding(false)
    }
  }

  // 第二步：确认绑定
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
        // 添加到 publications 列表，包含详情和快照
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
        // 清空输入框以便添加更多
        setNoteUrl('')
        setPendingNoteData(null)
      } else {
        setError(result.error || '绑定失败')
      }
    } catch (err) {
      setError('绑定失败')
    } finally {
      setBinding(false)
    }
  }

  // 取消绑定
  function handleCancelBind() {
    setShowBindingDialog(false)
    setPendingNoteData(null)
  }

  // 刷新作品数据
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

    // 保存到数据库
    try {
      await updateWorkImages(work._id.toString(), updatedDraftContent)
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

    // 保存到数据库
    try {
      await updateWorkImages(work._id.toString(), updatedDraftContent)
      setWork({ ...work, draftContent: updatedDraftContent })
    } catch (err) {
      console.error('保存配图失败:', err)
    }
  }

  // 打开封面重新生成对话框
  function openCoverRegenDialog() {
    setSelectedReason('')
    setCustomReason('')
    setShowCoverRegenDialog(true)
  }

  // 打开配图重新生成对话框
  function openImageRegenDialog(index: number) {
    setSelectedReason('')
    setCustomReason('')
    setShowImageRegenDialog(index)
  }

  // 关闭重新生成对话框
  function closeRegenDialog() {
    setShowCoverRegenDialog(false)
    setShowImageRegenDialog(null)
    setSelectedReason('')
    setCustomReason('')
  }

  // 重新生成封面规划
  async function handleRegenerateCoverPlan() {
    if (!draftContent || !selectedReason) return
    const reason = selectedReason === 'other' ? customReason : COVER_REGENERATE_REASONS.find(r => r.value === selectedReason)?.label || ''

    setShowCoverRegenDialog(false)
    setRegeneratingCover(true)
    setError('')

    try {
      const result = await regeneratePlan({
        planType: 'cover',
        reason,
        context: {
          positioning: draftContent.positioning,
          title: draftContent.title,
          content: draftContent.content,
          cover: draftContent.cover,
          images: draftContent.images,
        },
      })

      if (result.success && result.plan) {
        // 更新编辑状态
        setEditedCoverType(result.plan.type || '')
        setEditedCoverMainVisual(result.plan.mainVisual || '')
        setEditedCoverCopywriting(result.plan.copywriting || '')
        setEditedCoverColorScheme(result.plan.colorScheme || '')
      } else {
        setError(result.error || '重新生成封面规划失败')
      }
    } catch (err) {
      console.error('重新生成封面规划失败:', err)
      setError('重新生成封面规划失败')
    } finally {
      setRegeneratingCover(false)
      setSelectedReason('')
      setCustomReason('')
    }
  }

  // 重新生成配图规划
  async function handleRegenerateImagePlan(index: number) {
    if (!draftContent?.images || !selectedReason) return
    const reason = selectedReason === 'other' ? customReason : IMAGE_REGENERATE_REASONS.find(r => r.value === selectedReason)?.label || ''

    setShowImageRegenDialog(null)
    setRegeneratingImageIndex(index)
    setError('')

    try {
      const result = await regeneratePlan({
        planType: 'image',
        imageIndex: index,
        reason,
        context: {
          positioning: draftContent.positioning,
          title: draftContent.title,
          content: draftContent.content,
          cover: draftContent.cover,
          images: draftContent.images,
        },
      })

      if (result.success && result.plan) {
        // 更新编辑状态
        const newImages = [...editedImages]
        newImages[index] = {
          type: result.plan.type || editedImages[index]?.type || '',
          content: result.plan.content || editedImages[index]?.content || '',
          overlay: result.plan.overlay || '',
        }
        setEditedImages(newImages)
      } else {
        setError(result.error || '重新生成配图规划失败')
      }
    } catch (err) {
      console.error('重新生成配图规划失败:', err)
      setError('重新生成配图规划失败')
    } finally {
      setRegeneratingImageIndex(null)
      setSelectedReason('')
      setCustomReason('')
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
                  className="min-h-[200px] resize-y"
                  style={{ height: Math.max(200, (editedContent.split('\n').length + 1) * 24) + 'px' }}
                />
              ) : (
                <div className="whitespace-pre-wrap text-sm min-h-[100px]">
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
          {draftContent?.cover && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">封面规划</CardTitle>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={openCoverRegenDialog}
                    disabled={regeneratingCover}
                    title="重新生成封面规划"
                  >
                    {regeneratingCover ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  {/* 封面重新生成原因选择弹窗 */}
                  {showCoverRegenDialog && (
                    <div className="absolute top-full right-0 mt-2 z-50 bg-white border rounded-lg shadow-lg p-4 w-64">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium">选择重新生成的原因：</p>
                        <button
                          onClick={closeRegenDialog}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {COVER_REGENERATE_REASONS.map(reason => (
                          <label key={reason.value} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="coverReason"
                              value={reason.value}
                              checked={selectedReason === reason.value}
                              onChange={(e) => setSelectedReason(e.target.value)}
                              className="accent-primary"
                            />
                            {reason.label}
                          </label>
                        ))}
                      </div>
                      {selectedReason === 'other' && (
                        <Input
                          className="mt-2"
                          placeholder="请输入具体原因"
                          value={customReason}
                          onChange={(e) => setCustomReason(e.target.value)}
                        />
                      )}
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={closeRegenDialog}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={!selectedReason || (selectedReason === 'other' && !customReason)}
                          onClick={handleRegenerateCoverPlan}
                        >
                          确定
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {/* 左侧：图片生成 */}
                  <div className="w-40 flex-shrink-0">
                    <ImageGenerator
                      prompt={editedCoverMainVisual || draftContent.cover.mainVisual}
                      imageType="cover"
                      context={{
                        positioning: draftContent.positioning,
                        cover: draftContent.cover,
                        title: draftContent.title,
                        content: draftContent.content,
                        allImages: draftContent.images,
                      }}
                      onImageGenerated={handleCoverImageGenerated}
                      initialImageUrl={draftContent.cover.imageUrl}
                      initialPrompt={draftContent.cover.imagePrompt}
                      initialDesignId={draftContent.cover.chuangkitDesignId}
                      faceSeed={faceSeed || undefined}
                      onFaceSeedGenerated={setFaceSeed}
                      compact
                    />
                  </div>
                  {/* 右侧：规划信息 */}
                  <div className="flex-1 space-y-2 text-sm">
                    {isEditing ? (
                      <>
                        <div>
                          <Label className="text-xs font-semibold">类型</Label>
                          <Input
                            value={editedCoverType}
                            onChange={(e) => setEditedCoverType(e.target.value)}
                            placeholder="封面类型"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">主视觉</Label>
                          <Textarea
                            value={editedCoverMainVisual}
                            onChange={(e) => setEditedCoverMainVisual(e.target.value)}
                            placeholder="主视觉描述"
                            className="mt-1 min-h-[60px]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">文案</Label>
                          <Textarea
                            value={editedCoverCopywriting}
                            onChange={(e) => setEditedCoverCopywriting(e.target.value)}
                            placeholder="封面文案"
                            className="mt-1 min-h-[60px]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">配色</Label>
                          <Input
                            value={editedCoverColorScheme}
                            onChange={(e) => setEditedCoverColorScheme(e.target.value)}
                            placeholder="配色方案"
                            className="mt-1"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <p><strong>类型：</strong>{editedCoverType || draftContent.cover.type}</p>
                        <p><strong>主视觉：</strong>{editedCoverMainVisual || draftContent.cover.mainVisual}</p>
                        <p><strong>文案：</strong>{editedCoverCopywriting || draftContent.cover.copywriting}</p>
                        <p><strong>配色：</strong>{editedCoverColorScheme || draftContent.cover.colorScheme}</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 配图规划 */}
          {draftContent?.images && draftContent.images.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">配图 ({draftContent.images.length} 张)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {draftContent.images.map((img, i) => (
                  <div key={i} className="flex gap-4 p-3 bg-muted/50 rounded-lg">
                    {/* 左侧：图片生成 */}
                    <div className="w-40 flex-shrink-0">
                      <ImageGenerator
                        prompt={editedImages[i]?.content || img.content}
                        imageType="content"
                        context={{
                          positioning: draftContent.positioning,
                          cover: draftContent.cover,
                          title: draftContent.title,
                          content: draftContent.content,
                          allImages: draftContent.images,
                          currentImage: {
                            index: img.index || i + 1,
                            type: editedImages[i]?.type || img.type,
                            content: editedImages[i]?.content || img.content,
                            overlay: editedImages[i]?.overlay || img.overlay,
                            tips: img.tips,
                          },
                        }}
                        onImageGenerated={(url, prompt, designId) => handleImageGenerated(i, url, prompt, designId)}
                        initialImageUrl={img.imageUrl}
                        initialPrompt={img.imagePrompt}
                        initialDesignId={img.chuangkitDesignId}
                        faceSeed={faceSeed || undefined}
                        onFaceSeedGenerated={setFaceSeed}
                        compact
                      />
                    </div>
                    {/* 右侧：规划信息 */}
                    <div className="flex-1 text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">图 {img.index || i + 1}: {editedImages[i]?.type || img.type}</p>
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openImageRegenDialog(i)}
                            disabled={regeneratingImageIndex === i}
                            title="重新生成配图规划"
                            className="h-6 w-6 p-0"
                          >
                            {regeneratingImageIndex === i ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                          {/* 配图重新生成原因选择弹窗 */}
                          {showImageRegenDialog === i && (
                            <div className="absolute top-full right-0 mt-2 z-50 bg-white border rounded-lg shadow-lg p-4 w-64">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-medium">选择重新生成的原因：</p>
                                <button
                                  onClick={closeRegenDialog}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="space-y-2">
                                {IMAGE_REGENERATE_REASONS.map(reason => (
                                  <label key={reason.value} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`imageReason-${i}`}
                                      value={reason.value}
                                      checked={selectedReason === reason.value}
                                      onChange={(e) => setSelectedReason(e.target.value)}
                                      className="accent-primary"
                                    />
                                    {reason.label}
                                  </label>
                                ))}
                              </div>
                              {selectedReason === 'other' && (
                                <Input
                                  className="mt-2"
                                  placeholder="请输入具体原因"
                                  value={customReason}
                                  onChange={(e) => setCustomReason(e.target.value)}
                                />
                              )}
                              <div className="flex gap-2 mt-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={closeRegenDialog}
                                >
                                  取消
                                </Button>
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  disabled={!selectedReason || (selectedReason === 'other' && !customReason)}
                                  onClick={() => handleRegenerateImagePlan(i)}
                                >
                                  确定
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs font-semibold">类型</Label>
                            <Input
                              value={editedImages[i]?.type || ''}
                              onChange={(e) => {
                                const newImages = [...editedImages]
                                newImages[i] = { ...newImages[i], type: e.target.value }
                                setEditedImages(newImages)
                              }}
                              placeholder="配图类型"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold">内容描述</Label>
                            <Textarea
                              value={editedImages[i]?.content || ''}
                              onChange={(e) => {
                                const newImages = [...editedImages]
                                newImages[i] = { ...newImages[i], content: e.target.value }
                                setEditedImages(newImages)
                              }}
                              placeholder="配图内容描述"
                              className="mt-1 min-h-[60px]"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold">文字叠加</Label>
                            <Input
                              value={editedImages[i]?.overlay || ''}
                              onChange={(e) => {
                                const newImages = [...editedImages]
                                newImages[i] = { ...newImages[i], overlay: e.target.value }
                                setEditedImages(newImages)
                              }}
                              placeholder="图片上的文字"
                              className="mt-1"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-muted-foreground">{editedImages[i]?.content || img.content}</p>
                          {(editedImages[i]?.overlay || img.overlay) && (
                            <p className="text-muted-foreground mt-1">文字：{editedImages[i]?.overlay || img.overlay}</p>
                          )}
                        </>
                      )}
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

          {/* 绑定笔记链接 - 始终显示 */}
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
