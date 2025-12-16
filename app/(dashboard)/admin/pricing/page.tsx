'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save } from 'lucide-react'
import { getPricingList, updatePricing } from '@/actions/admin'
import { formatPrice } from '@/types/pricing'
import type { PricingItem } from '@/types/pricing'

export default function PricingPage() {
  const [items, setItems] = useState<PricingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editPrices, setEditPrices] = useState<Record<string, number>>({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadData = async () => {
      const data = await getPricingList()
      setItems(data)
      // 初始化编辑价格 (转换为元)
      const prices: Record<string, number> = {}
      data.forEach((item: PricingItem) => {
        prices[item._id.toString()] = item.price / 100
      })
      setEditPrices(prices)
      setLoading(false)
    }
    loadData()
  }, [])

  const handlePriceChange = (id: string, value: string) => {
    const price = parseFloat(value) || 0
    setEditPrices(prev => ({ ...prev, [id]: price }))
  }

  const handleSave = async (item: PricingItem) => {
    const id = item._id.toString()
    const newPriceCents = Math.round((editPrices[id] || 0) * 100)

    if (newPriceCents === item.price) {
      return // 没有变化
    }

    setSaving(id)
    setMessage('')

    const result = await updatePricing(id, { price: newPriceCents })
    if (result.success) {
      setItems(prev => prev.map(i =>
        i._id.toString() === id ? { ...i, price: newPriceCents } : i
      ))
      setMessage('保存成功')
    }
    setSaving(null)
  }

  const handleToggle = async (item: PricingItem) => {
    const id = item._id.toString()
    setSaving(id)
    setMessage('')

    const result = await updatePricing(id, { enabled: !item.enabled })
    if (result.success) {
      setItems(prev => prev.map(i =>
        i._id.toString() === id ? { ...i, enabled: !i.enabled } : i
      ))
    }
    setSaving(null)
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">价格配置</h1>
        <p className="text-muted-foreground">设置各功能的扣费价格</p>
      </div>

      {message && <div className="text-sm text-green-600 bg-green-50 p-3 rounded">{message}</div>}

      <Card>
        <CardHeader>
          <CardTitle>功能定价</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((item) => {
              const id = item._id.toString()
              const isChanged = Math.round((editPrices[id] || 0) * 100) !== item.price

              return (
                <div key={id} className="flex items-center gap-4 p-4 border rounded">
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">¥</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="w-24"
                      value={editPrices[id] ?? 0}
                      onChange={(e) => handlePriceChange(id, e.target.value)}
                      disabled={saving === id}
                    />
                    <Button
                      size="sm"
                      variant={isChanged ? 'default' : 'ghost'}
                      onClick={() => handleSave(item)}
                      disabled={saving === id || !isChanged}
                    >
                      {saving === id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {item.enabled ? '启用' : '禁用'}
                    </span>
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={() => handleToggle(item)}
                      disabled={saving === id}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
