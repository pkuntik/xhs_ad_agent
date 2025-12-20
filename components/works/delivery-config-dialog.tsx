'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Settings, DollarSign, Target, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { updateDeliveryConfig, startManagedDelivery } from '@/actions/delivery'
import type { DeliveryConfig } from '@/types/work'

interface DeliveryConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workId: string
  publicationIndex: number
  currentConfig?: DeliveryConfig
  noteTitle?: string
  onSaved?: () => void
}

// 默认配置
const DEFAULT_CONFIG: DeliveryConfig = {
  enabled: false,
  budget: 2000,
  checkThreshold1: 60,
  checkThreshold2: 120,
  maxRetries: 3,
}

export function DeliveryConfigDialog({
  open,
  onOpenChange,
  workId,
  publicationIndex,
  currentConfig,
  noteTitle,
  onSaved,
}: DeliveryConfigDialogProps) {
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<DeliveryConfig>(currentConfig || DEFAULT_CONFIG)

  // 当对话框打开时重置配置
  useEffect(() => {
    if (open) {
      setConfig(currentConfig || DEFAULT_CONFIG)
    }
  }, [open, currentConfig])

  async function handleSave() {
    setSaving(true)

    try {
      const result = await updateDeliveryConfig(workId, publicationIndex, config)
      if (result.success) {
        toast.success('托管配置已保存')
        onOpenChange(false)
        onSaved?.()
      } else {
        toast.error(result.error || '保存失败')
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleStartDelivery() {
    setSaving(true)

    try {
      // 先保存配置
      await updateDeliveryConfig(workId, publicationIndex, config)

      // 开始投放
      const result = await startManagedDelivery(workId, publicationIndex)
      if (result.success) {
        toast.success('托管投放已启动')
        onOpenChange(false)
        onSaved?.()
      } else {
        toast.error(result.error || '启动失败')
      }
    } catch {
      toast.error('启动失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            托管投放配置
          </DialogTitle>
          {noteTitle && (
            <DialogDescription className="truncate">{noteTitle}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 预算设置 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              单次投放预算
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={config.budget}
                onChange={(e) => setConfig({ ...config, budget: Number(e.target.value) })}
                min={100}
                max={10000}
                step={100}
              />
              <span className="text-sm text-muted-foreground">元</span>
            </div>
            <p className="text-xs text-muted-foreground">
              每次投放的预算上限，建议 2000 元
            </p>
          </div>

          {/* 检查阈值1 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              咨询检查阈值
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={config.checkThreshold1}
                onChange={(e) => setConfig({ ...config, checkThreshold1: Number(e.target.value) })}
                min={10}
                max={500}
                step={10}
              />
              <span className="text-sm text-muted-foreground">元</span>
            </div>
            <p className="text-xs text-muted-foreground">
              消耗达到此金额后检查是否有私信咨询
            </p>
          </div>

          {/* 检查阈值2 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              加粉检查阈值
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={config.checkThreshold2}
                onChange={(e) => setConfig({ ...config, checkThreshold2: Number(e.target.value) })}
                min={50}
                max={1000}
                step={10}
              />
              <span className="text-sm text-muted-foreground">元</span>
            </div>
            <p className="text-xs text-muted-foreground">
              消耗达到此金额后检查是否有企微加粉
            </p>
          </div>

          {/* 最大重试次数 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              最大重试次数
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={config.maxRetries}
                onChange={(e) => setConfig({ ...config, maxRetries: Number(e.target.value) })}
                min={1}
                max={10}
                step={1}
              />
              <span className="text-sm text-muted-foreground">次</span>
            </div>
            <p className="text-xs text-muted-foreground">
              连续无效果时最多重试次数，超过后自动停止
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            保存配置
          </Button>
          <Button onClick={handleStartDelivery} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            保存并启动
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
