'use client'

import React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Gender, AgeRange, CustomAudience } from '@/types/creation'

const AGE_RANGES: AgeRange[] = ['不限', '18-23', '24-30', '31-40', '41-50', '大于50岁']

interface CustomAudienceSelectorProps {
  value: CustomAudience
  onChange: (audience: CustomAudience) => void
  className?: string
}

export function CustomAudienceSelector({ value, onChange, className }: CustomAudienceSelectorProps) {
  const toggleAgeRange = (ageRange: AgeRange) => {
    const currentRanges = value.ageRanges || []

    if (ageRange === '不限') {
      // 点击"不限"时，清除其他选项，只保留"不限"
      const newRanges = currentRanges.includes('不限') ? [] : ['不限'] as AgeRange[]
      onChange({ ...value, ageRanges: newRanges })
    } else {
      // 点击具体年龄段时，移除"不限"
      const rangesWithoutUnlimited = currentRanges.filter(r => r !== '不限')
      const newRanges = rangesWithoutUnlimited.includes(ageRange)
        ? rangesWithoutUnlimited.filter(r => r !== ageRange)
        : [...rangesWithoutUnlimited, ageRange]
      onChange({ ...value, ageRanges: newRanges })
    }
  }

  return (
    <div className={`space-y-4 p-4 border rounded-lg bg-muted/30 ${className || ''}`}>
      <div className="space-y-2">
        <Label>性别</Label>
        <Select
          value={value.gender}
          onValueChange={(v) => onChange({ ...value, gender: v as Gender })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="不限">不限</SelectItem>
            <SelectItem value="男">男</SelectItem>
            <SelectItem value="女">女</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>年龄段（可多选）</Label>
        <div className="flex flex-wrap gap-2">
          {AGE_RANGES.map((age) => (
            <Badge
              key={age}
              variant={(value.ageRanges || []).includes(age) ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/80"
              onClick={() => toggleAgeRange(age)}
            >
              {age}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>地区（可选）</Label>
        <Input
          value={value.location || ''}
          onChange={(e) => onChange({ ...value, location: e.target.value })}
          placeholder="例如：一二线城市、北上广深"
        />
      </div>

      <div className="space-y-2">
        <Label>兴趣标签（可选）</Label>
        <Input
          value={value.interests || ''}
          onChange={(e) => onChange({ ...value, interests: e.target.value })}
          placeholder="例如：美妆、护肤、健身"
        />
      </div>
    </div>
  )
}
