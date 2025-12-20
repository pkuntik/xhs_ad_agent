import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化金额（元）
 */
export function formatMoney(amount: number | undefined | null): string {
  const value = amount ?? 0
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value)
}

/**
 * 格式化数字
 */
export function formatNumber(num: number | undefined | null): string {
  const value = num ?? 0
  return new Intl.NumberFormat('zh-CN').format(value)
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date: Date | string | number): string {
  const d = new Date(date)
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
