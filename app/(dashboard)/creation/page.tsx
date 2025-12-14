'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Sparkles, Copy, Check, Save, Edit2 } from 'lucide-react'
import { generateContent } from '@/actions/creation'
import { saveWork } from '@/actions/work'
import type {
  CreationFormData,
  GenerationResult,
  PromotionGoal,
  ContentScene,
} from '@/types/creation'

const PROMOTION_GOALS: PromotionGoal[] = [
  '笔记阅读量',
  '点赞收藏量',
  '私信咨询量',
  '粉丝关注量',
  '主页浏览量',
  '直播观看量',
]

const CONTENT_SCENES: ContentScene[] = [
  '产品种草',
  '引流咨询',
  '个人IP打造',
  '知识干货',
  '服务推广',
]

export default function CreationPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<CreationFormData>({
    promotionGoal: '私信咨询量',
    topic: '',
    contentScene: '引流咨询',
    audienceType: '智能推荐',
    generationOptions: {
      cover: true,
      title: true,
      content: true,
      images: true,
      comments: true,
      topics: true,
      privateMessage: false,
    },
  })

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [rawText, setRawText] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // 编辑状态的内容
  const [editedTitle, setEditedTitle] = useState('')
  const [editedContent, setEditedContent] = useState('')
  const [editedTopics, setEditedTopics] = useState('')

  async function handleGenerate() {
    if (!formData.topic.trim()) {
      setError('请输入选题方向')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setRawText('')
    setIsEditing(false)

    try {
      const response = await generateContent(formData)

      if (!response.success) {
        setError(response.error || '生成失败')
        return
      }

      if (response.rawText) {
        setRawText(response.rawText)
      }

      if (response.result) {
        setResult(response.result)
        // 初始化编辑内容
        setEditedTitle(response.result.title?.text || '')
        setEditedContent(response.result.content?.body || '')
        setEditedTopics(response.result.topics?.tags.join(' ') || '')
      }
    } catch (err: any) {
      setError(err.message || '生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  function startEditing() {
    if (result) {
      setEditedTitle(result.title?.text || '')
      setEditedContent(result.content?.body || '')
      setEditedTopics(result.topics?.tags.join(' ') || '')
      setIsEditing(true)
    }
  }

  function cancelEditing() {
    setIsEditing(false)
  }

  async function handleSave() {
    if (!result) return

    setSaving(true)
    setError('')

    try {
      // 构建更新后的结果
      const updatedResult: GenerationResult = {
        ...result,
        title: result.title ? { ...result.title, text: editedTitle } : undefined,
        content: result.content ? { ...result.content, body: editedContent } : undefined,
        topics: result.topics ? { ...result.topics, tags: editedTopics.split(/\s+/).filter(Boolean) } : undefined,
      }

      const response = await saveWork({
        title: editedTitle || result.title?.text || '未命名作品',
        content: editedContent || result.content?.body,
        tags: editedTopics.split(/\s+/).filter(Boolean),
        draftContent: updatedResult,
      })

      if (!response.success) {
        setError(response.error || '保存失败')
        return
      }

      // 保存成功，跳转到作品详情页
      router.push(`/works/${response.id}`)
    } catch (err: any) {
      setError(err.message || '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI 创作</h2>
        <p className="text-muted-foreground">
          使用 AI 生成小红书笔记内容
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左侧：输入表单 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>创作设置</CardTitle>
              <CardDescription>配置你的内容生成参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>选题方向 / 关键词 *</Label>
                <Textarea
                  placeholder="例如：减肥、护肤、穿搭、美食探店..."
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>推广目标</Label>
                  <Select
                    value={formData.promotionGoal}
                    onValueChange={(v: string) => setFormData({ ...formData, promotionGoal: v as PromotionGoal })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROMOTION_GOALS.map((goal) => (
                        <SelectItem key={goal} value={goal}>{goal}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>内容场景</Label>
                  <Select
                    value={formData.contentScene}
                    onValueChange={(v: string) => setFormData({ ...formData, contentScene: v as ContentScene })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_SCENES.map((scene) => (
                        <SelectItem key={scene} value={scene}>{scene}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>补充说明</Label>
                <Textarea
                  placeholder="可选：补充产品信息、风格偏好等"
                  value={formData.additionalInfo || ''}
                  onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>生成内容</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'cover', label: '封面' },
                    { key: 'title', label: '标题' },
                    { key: 'content', label: '正文' },
                    { key: 'images', label: '配图' },
                    { key: 'comments', label: '评论' },
                    { key: 'topics', label: '话题' },
                    { key: 'privateMessage', label: '私信' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={formData.generationOptions?.[key as keyof typeof formData.generationOptions] ?? true}
                        onCheckedChange={(checked: boolean) => {
                          setFormData({
                            ...formData,
                            generationOptions: {
                              ...formData.generationOptions!,
                              [key]: checked,
                            },
                          })
                        }}
                      />
                      <Label htmlFor={key} className="text-sm">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md whitespace-pre-wrap">
                  {error}
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    生成中（约30秒）...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    开始生成
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：生成结果 */}
        <div className="space-y-4">
          {loading && (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">AI 正在生成内容，请稍候...</p>
                <p className="text-xs text-muted-foreground mt-2">通常需要 20-40 秒</p>
              </CardContent>
            </Card>
          )}

          {!loading && result && (
            <>
              {/* 操作按钮栏 */}
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {isEditing ? '编辑模式' : '预览模式'}
                    </span>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button variant="outline" size="sm" onClick={cancelEditing}>
                            取消
                          </Button>
                          <Button size="sm" onClick={handleSave} disabled={saving}>
                            {saving ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                保存中...
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                保存到作品中心
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={startEditing}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            编辑
                          </Button>
                          <Button size="sm" onClick={handleSave} disabled={saving}>
                            {saving ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                保存中...
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                保存到作品中心
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 标题 */}
              {result.title && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">标题</CardTitle>
                      {!isEditing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(editedTitle || result.title!.text, 'title')}
                        >
                          {copied === 'title' ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <Input
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        placeholder="输入标题"
                      />
                    ) : (
                      <p className="font-medium">{editedTitle || result.title.text}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 正文 */}
              {result.content && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        正文 ({(editedContent || result.content.body).length} 字)
                      </CardTitle>
                      {!isEditing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(editedContent || result.content!.body, 'content')}
                        >
                          {copied === 'content' ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
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
                        {editedContent || result.content.body}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 话题标签 */}
              {result.topics && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">话题标签</CardTitle>
                      {!isEditing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(editedTopics || result.topics!.tags.join(' '), 'topics')}
                        >
                          {copied === 'topics' ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
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
                        {(editedTopics || result.topics.tags.join(' ')).split(/\s+/).filter(Boolean).map((tag, i) => (
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
              )}

              {/* 封面规划 */}
              {result.cover && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">封面规划</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>类型：</strong>{result.cover.type}</p>
                    <p><strong>主视觉：</strong>{result.cover.mainVisual}</p>
                    <p><strong>文案：</strong>{result.cover.copywriting}</p>
                    <p><strong>配色：</strong>{result.cover.colorScheme}</p>
                  </CardContent>
                </Card>
              )}

              {/* 配图规划 */}
              {result.images && result.images.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">配图规划</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.images.map((img, i) => (
                      <div key={i} className="p-3 bg-muted/50 rounded-md text-sm">
                        <p className="font-medium">图 {img.index || i + 1}</p>
                        <p>{img.content}</p>
                        {img.overlay && <p className="text-muted-foreground">文字：{img.overlay}</p>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 评论区运营 */}
              {result.comments && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">评论区运营</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {result.comments.pinnedComment && (
                      <div className="p-2 bg-yellow-50 rounded">
                        <strong>置顶：</strong>{result.comments.pinnedComment}
                      </div>
                    )}
                    {result.comments.qaList.map((qa, i) => (
                      <div key={i} className="p-2 bg-muted/50 rounded">
                        <p><strong>Q：</strong>{qa.question}</p>
                        <p><strong>A：</strong>{qa.answer}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 私信模板 */}
              {result.privateMessage && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">私信模板</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>开场白：</strong>{result.privateMessage.greeting}</p>
                    {result.privateMessage.templates.map((tpl, i) => (
                      <div key={i} className="p-2 bg-muted/50 rounded">
                        <p className="text-xs text-muted-foreground">{tpl.scenario}</p>
                        <p>{tpl.message}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 原始 JSON（调试用） */}
              {rawText && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">原始输出</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs whitespace-pre-wrap bg-muted p-4 rounded-md max-h-48 overflow-auto">
                      {rawText}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!loading && !result && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                填写左侧表单并点击"开始生成"
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
