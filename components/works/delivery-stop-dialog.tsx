'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, StopCircle, Pause, PlayCircle } from 'lucide-react'
import { toast } from 'sonner'
import { stopManagedDelivery } from '@/actions/delivery'

interface DeliveryStopDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workId: string
  publicationIndex: number
  noteTitle?: string
  onStopped?: () => void
}

type StopAction = 'pause' | 'continue_no_restart'

export function DeliveryStopDialog({
  open,
  onOpenChange,
  workId,
  publicationIndex,
  noteTitle,
  onStopped,
}: DeliveryStopDialogProps) {
  const [stopping, setStopping] = useState(false)
  const [action, setAction] = useState<StopAction>('pause')

  async function handleStop() {
    setStopping(true)

    try {
      const result = await stopManagedDelivery(workId, publicationIndex, action)
      if (result.success) {
        toast.success(action === 'pause' ? '投放已暂停' : '托管已关闭，当前投放将继续运行')
        onOpenChange(false)
        onStopped?.()
      } else {
        toast.error(result.error || '操作失败')
      }
    } catch {
      toast.error('操作失败')
    } finally {
      setStopping(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StopCircle className="h-5 w-5 text-orange-500" />
            关闭托管投放
          </DialogTitle>
          {noteTitle && (
            <DialogDescription className="truncate">{noteTitle}</DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            请选择如何处理当前正在运行的投放计划：
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setAction('pause')}
              className={`w-full flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer text-left transition-colors ${
                action === 'pause' ? 'border-purple-500 bg-purple-50' : ''
              }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                action === 'pause' ? 'border-purple-600' : 'border-gray-300'
              }`}>
                {action === 'pause' && <div className="w-2 h-2 rounded-full bg-purple-600" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <Pause className="h-4 w-4 text-orange-500" />
                  立即暂停投放
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  立即暂停当前投放计划，停止消耗预算。可以随时恢复。
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAction('continue_no_restart')}
              className={`w-full flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer text-left transition-colors ${
                action === 'continue_no_restart' ? 'border-purple-500 bg-purple-50' : ''
              }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                action === 'continue_no_restart' ? 'border-purple-600' : 'border-gray-300'
              }`}>
                {action === 'continue_no_restart' && <div className="w-2 h-2 rounded-full bg-purple-600" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <PlayCircle className="h-4 w-4 text-blue-500" />
                  继续运行到结束
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  让当前投放计划继续运行直到预算用完，但不再自动重新投放。
                </p>
              </div>
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant={action === 'pause' ? 'default' : 'secondary'}
            onClick={handleStop}
            disabled={stopping}
          >
            {stopping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
