'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, Save, RefreshCw } from 'lucide-react'
import { getNoteSyncSettings, updateNoteSyncSettings } from '@/actions/settings'
import type { NoteSyncSettings } from '@/types/settings'

export default function SyncSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 设置状态
  const [enabled, setEnabled] = useState(true)
  const [adaptiveSync, setAdaptiveSync] = useState(true)
  const [adaptiveMultiplier, setAdaptiveMultiplier] = useState(2)
  const [newNoteInterval, setNewNoteInterval] = useState(30)
  const [newNoteThreshold, setNewNoteThreshold] = useState(24)
  const [recentNoteInterval, setRecentNoteInterval] = useState(120)
  const [recentNoteThreshold, setRecentNoteThreshold] = useState(7)
  const [oldNoteInterval, setOldNoteInterval] = useState(360)

  useEffect(() => {
    async function loadSettings() {
      try {
        const result = await getNoteSyncSettings()
        if (result.success && result.settings) {
          const s = result.settings
          setEnabled(s.enabled)
          setAdaptiveSync(s.adaptiveSync)
          setAdaptiveMultiplier(s.adaptiveMultiplier)
          setNewNoteInterval(s.strategies.newNoteInterval)
          setNewNoteThreshold(s.strategies.newNoteThreshold)
          setRecentNoteInterval(s.strategies.recentNoteInterval)
          setRecentNoteThreshold(s.strategies.recentNoteThreshold)
          setOldNoteInterval(s.strategies.oldNoteInterval)
        }
      } catch (err) {
        setError('加载设置失败')
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const result = await updateNoteSyncSettings({
        enabled,
        adaptiveSync,
        adaptiveMultiplier,
        strategies: {
          newNoteInterval,
          newNoteThreshold,
          recentNoteInterval,
          recentNoteThreshold,
          oldNoteInterval,
        },
      })

      if (result.success) {
        setSuccess('设置已保存')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(result.error || '保存失败')
      }
    } catch (err) {
      setError('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 计算预估每日 API 调用次数
  function estimateDailyApiCalls(): number {
    if (!enabled) return 0

    // 假设有 10 个绑定的笔记，分布为：2 个新笔记，3 个近期，5 个较老
    const newNoteCalls = 2 * (24 * 60 / newNoteInterval)
    const recentNoteCalls = 3 * (24 * 60 / recentNoteInterval)
    const oldNoteCalls = 5 * (24 * 60 / oldNoteInterval)

    return Math.round(newNoteCalls + recentNoteCalls + oldNoteCalls)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">数据同步设置</h2>
          <p className="text-muted-foreground">
            配置笔记数据的自动同步策略
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 基本设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本设置</CardTitle>
            <CardDescription>控制自动同步的开关和自适应功能</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>启用自动同步</Label>
                <p className="text-sm text-muted-foreground">
                  自动定期更新已绑定笔记的数据
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>自适应同步</Label>
                <p className="text-sm text-muted-foreground">
                  根据数据变化自动调整同步频率
                </p>
              </div>
              <Switch
                checked={adaptiveSync}
                onCheckedChange={setAdaptiveSync}
                disabled={!enabled}
              />
            </div>

            {adaptiveSync && enabled && (
              <div className="space-y-2">
                <Label>加速倍率</Label>
                <p className="text-xs text-muted-foreground">
                  数据变化明显时，同步频率提高的倍数
                </p>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={adaptiveMultiplier}
                  onChange={(e) => setAdaptiveMultiplier(Number(e.target.value))}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 预估信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">预估信息</CardTitle>
            <CardDescription>基于当前设置的预估数据</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">预估每日 API 调用</p>
                  <p className="text-xs text-muted-foreground">
                    假设绑定 10 个笔记（2新+3近期+5较老）
                  </p>
                </div>
                <p className="text-2xl font-bold">
                  {estimateDailyApiCalls()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">次/天</span>
                </p>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  新笔记：每 {newNoteInterval} 分钟同步一次
                </p>
                <p className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  近期笔记：每 {recentNoteInterval} 分钟同步一次
                </p>
                <p className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  较老笔记：每 {oldNoteInterval} 分钟同步一次
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 同步间隔设置 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">同步间隔设置</CardTitle>
            <CardDescription>
              根据笔记发布时间设置不同的同步频率
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              {/* 新笔记 */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">新笔记</h4>
                  <p className="text-xs text-muted-foreground">
                    发布时间在阈值内的笔记
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>同步间隔（分钟）</Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={newNoteInterval}
                    onChange={(e) => setNewNoteInterval(Number(e.target.value))}
                    disabled={!enabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label>时间阈值（小时）</Label>
                  <Input
                    type="number"
                    min={1}
                    max={72}
                    value={newNoteThreshold}
                    onChange={(e) => setNewNoteThreshold(Number(e.target.value))}
                    disabled={!enabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    发布 {newNoteThreshold} 小时内算新笔记
                  </p>
                </div>
              </div>

              {/* 近期笔记 */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">近期笔记</h4>
                  <p className="text-xs text-muted-foreground">
                    超过新笔记阈值但在近期阈值内
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>同步间隔（分钟）</Label>
                  <Input
                    type="number"
                    min={30}
                    max={360}
                    value={recentNoteInterval}
                    onChange={(e) => setRecentNoteInterval(Number(e.target.value))}
                    disabled={!enabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label>时间阈值（天）</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={recentNoteThreshold}
                    onChange={(e) => setRecentNoteThreshold(Number(e.target.value))}
                    disabled={!enabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    发布 {recentNoteThreshold} 天内算近期笔记
                  </p>
                </div>
              </div>

              {/* 较老笔记 */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">较老笔记</h4>
                  <p className="text-xs text-muted-foreground">
                    超过近期阈值的笔记
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>同步间隔（分钟）</Label>
                  <Input
                    type="number"
                    min={60}
                    max={1440}
                    value={oldNoteInterval}
                    onChange={(e) => setOldNoteInterval(Number(e.target.value))}
                    disabled={!enabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    约 {Math.round(oldNoteInterval / 60)} 小时同步一次
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              保存设置
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
