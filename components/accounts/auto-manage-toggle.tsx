'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toggleAutoManage } from '@/actions/account'

interface AutoManageToggleProps {
  accountId: string
  initialEnabled: boolean
}

export function AutoManageToggle({
  accountId,
  initialEnabled,
}: AutoManageToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)

  const handleToggle = async (checked: boolean) => {
    setLoading(true)
    try {
      const result = await toggleAutoManage(accountId, checked)
      if (result.success) {
        setEnabled(checked)
      } else {
        console.error('切换失败:', result.error)
      }
    } catch (error) {
      console.error('切换自动托管失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id={`auto-manage-${accountId}`}
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={loading}
      />
      <Label
        htmlFor={`auto-manage-${accountId}`}
        className="text-sm cursor-pointer"
      >
        {enabled ? '自动托管中' : '手动模式'}
      </Label>
    </div>
  )
}
