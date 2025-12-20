'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Settings,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  User,
  KeyRound,
  Pin,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AutoManageToggle } from './auto-manage-toggle'
import { formatMoney } from '@/lib/utils'
import { toggleAccountPin } from '@/actions/account'
import { toast } from 'sonner'
import type { AccountListItem } from '@/types/account'

interface AccountCardProps {
  account: AccountListItem
}

const statusMap = {
  pending: { label: '待完善', variant: 'outline' as const },
  active: { label: '正常', variant: 'success' as const },
  inactive: { label: '已停用', variant: 'secondary' as const },
  suspended: { label: '已暂停', variant: 'warning' as const },
  cookie_expired: { label: 'Cookie过期', variant: 'destructive' as const },
}

// 角色类型映射
const roleTypeMap: Record<number, string> = {
  602: '主账号',
  603: '子账号',
  604: '代理商',
}

// 认证状态映射
const certificationMap: Record<number, { label: string; color: string }> = {
  0: { label: '未认证', color: 'text-gray-500' },
  1: { label: '认证中', color: 'text-yellow-600' },
  2: { label: '已认证', color: 'text-green-600' },
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  return new Date(date).toLocaleDateString('zh-CN')
}

export function AccountCard({ account }: AccountCardProps) {
  const [isPinned, setIsPinned] = useState(account.isPinned ?? false)
  const [pinning, setPinning] = useState(false)

  const status = statusMap[account.status] || statusMap.inactive
  const roleLabel = roleTypeMap[account.roleType || 0] || '未知角色'
  const certStatus = certificationMap[account.accountStatusDetail?.certificationState || 0] || certificationMap[0]
  const isPending = account.status === 'pending'

  // 检查是否有异常
  const hasIssues = account.hasAbnormalIssues
  const issues: string[] = []
  const statusDetail = account.accountStatusDetail

  if (statusDetail?.isSubAccountFrozen) {
    issues.push('子账号已冻结')
    const freezeReasons = statusDetail.freezeReasons
    if (freezeReasons && freezeReasons.length > 0) {
      issues.push(...freezeReasons)
    }
  }
  const abnormalReasons = statusDetail?.abnormalReasons
  if (abnormalReasons && abnormalReasons.length > 0) {
    issues.push(...abnormalReasons)
  }
  if (statusDetail?.adStatus !== 1 && statusDetail?.adStatus !== undefined) {
    issues.push('广告投放受限')
  }
  if (statusDetail?.subjectState !== 200 && statusDetail?.subjectState) {
    issues.push('主体资质异常')
  }
  if (statusDetail?.promotionQualityState !== 200 && statusDetail?.promotionQualityState) {
    issues.push('推广资质异常')
  }

  async function handleTogglePin() {
    setPinning(true)
    try {
      const result = await toggleAccountPin(account._id, !isPinned)
      if (result.success) {
        setIsPinned(!isPinned)
        toast.success(isPinned ? '已取消置顶' : '已置顶')
      } else {
        toast.error(result.error || '操作失败')
      }
    } catch {
      toast.error('操作失败')
    } finally {
      setPinning(false)
    }
  }

  return (
    <Card className={`${hasIssues ? 'border-orange-200' : ''} ${isPinned ? 'ring-2 ring-primary/20' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* 头像 */}
          <div className="relative">
            {account.avatar ? (
              <Image
                src={account.avatar}
                alt={account.nickname || account.name}
                width={48}
                height={48}
                className="rounded-full"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            {/* 登录方式指示器 */}
            {account.loginType === 'password' && (
              <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5" title="账号密码登录">
                <KeyRound className="h-3 w-3 text-white" />
              </div>
            )}
          </div>

          {/* 名称和状态 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isPinned && (
                <Pin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              )}
              <Link
                href={`/accounts/${account._id}`}
                className="font-medium text-base hover:text-primary transition-colors truncate"
              >
                {account.nickname || account.name}
              </Link>
              <Badge variant={status.variant} className="flex-shrink-0">{status.label}</Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {/* 角色类型 */}
              <span className="text-xs text-muted-foreground">{roleLabel}</span>
              {/* 子账号标记 */}
              {account.subAccount && (
                <Badge variant="outline" className="text-xs py-0 h-5">子账号</Badge>
              )}
              {/* 认证状态 */}
              <span className={`text-xs flex items-center gap-0.5 ${certStatus.color}`}>
                {statusDetail?.certificationState === 2 ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : (
                  <ShieldAlert className="h-3 w-3" />
                )}
                {certStatus.label}
              </span>
            </div>
          </div>

          {/* 置顶按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={handleTogglePin}
            disabled={pinning}
            title={isPinned ? '取消置顶' : '置顶'}
          >
            <Pin className={`h-4 w-4 ${isPinned ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
          </Button>
        </div>

        {/* 异常警告 */}
        {hasIssues && issues.length > 0 && (
          <div
            className="flex items-center gap-1.5 mt-2 p-2 bg-orange-50 rounded-md text-orange-700 cursor-help"
            title={issues.join('\n')}
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs font-medium truncate">{issues[0]}</span>
            {issues.length > 1 && (
              <span className="text-xs">+{issues.length - 1}</span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2.5">
          {/* 待完善账号提示 */}
          {isPending && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">请添加登录凭证完善账号信息</p>
              <Link href={`/accounts/${account._id}/settings`}>
                <Button variant="outline" size="sm" className="mt-2">
                  <KeyRound className="h-4 w-4 mr-1" />
                  添加凭证
                </Button>
              </Link>
            </div>
          )}

          {/* 完整账号信息 */}
          {!isPending && (
            <>
              {/* 余额 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">账户余额</span>
                <span className="text-lg font-semibold">
                  {formatMoney(account.balance)}
                </span>
              </div>

              {/* 权限数量 */}
              {account.permissionsCount !== undefined && account.permissionsCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">权限数量</span>
                  <span className="text-sm">{account.permissionsCount} 项</span>
                </div>
              )}

              {/* 每日预算 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">每日预算</span>
                <span className="text-sm">{formatMoney(account.dailyBudget)}</span>
              </div>

              {/* 默认出价 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">默认出价</span>
                <span className="text-sm">
                  {formatMoney(account.defaultBidAmount)}
                </span>
              </div>

              {/* 最后同步时间 */}
              {account.lastSyncAt && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    最后同步
                  </span>
                  <span>{formatTimeAgo(account.lastSyncAt)}</span>
                </div>
              )}

              {/* 分隔线和操作区 */}
              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <AutoManageToggle
                    accountId={account._id.toString()}
                    initialEnabled={account.autoManaged ?? false}
                  />
                  <Link href={`/accounts/${account._id}/settings`}>
                    <Button variant="ghost" size="icon">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
