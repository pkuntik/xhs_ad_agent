import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  change?: number
  changeLabel?: string
  status?: 'good' | 'bad' | 'neutral'
  icon?: React.ReactNode
}

export function StatsCard({
  title,
  value,
  description,
  change,
  changeLabel,
  status = 'neutral',
  icon,
}: StatsCardProps) {
  const TrendIcon =
    change && change > 0
      ? TrendingUp
      : change && change < 0
        ? TrendingDown
        : Minus

  const statusColors = {
    good: 'bg-green-100 text-green-800',
    bad: 'bg-red-100 text-red-800',
    neutral: 'bg-gray-100 text-gray-800',
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {change !== undefined && (
          <div className="flex items-center mt-2">
            <TrendIcon
              className={cn(
                'h-4 w-4 mr-1',
                change > 0
                  ? 'text-green-600'
                  : change < 0
                    ? 'text-red-600'
                    : 'text-gray-400'
              )}
            />
            <span
              className={cn(
                'text-xs',
                change > 0
                  ? 'text-green-600'
                  : change < 0
                    ? 'text-red-600'
                    : 'text-gray-400'
              )}
            >
              {change > 0 ? '+' : ''}
              {change}%
            </span>
            {changeLabel && (
              <span className="text-xs text-muted-foreground ml-1">
                {changeLabel}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
