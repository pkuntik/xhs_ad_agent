import type { DeliveryLog, DeliveryDecision } from '@/types/delivery-log'
import type { AccountThresholds } from '@/types/account'

export interface RuleContext {
  logs: DeliveryLog[]
  thresholds: AccountThresholds
  consecutiveFailures: number
  currentSpent: number
  currentLeads: number
  currentCostPerLead: number
}

export interface RuleResult {
  decision: DeliveryDecision
  reason: string
  shouldScheduleNextCheck: boolean
  nextCheckMinutes?: number
}

/**
 * 投放效果评估规则引擎
 *
 * 核心决策逻辑：
 * 1. 消耗 < 100：继续等待
 * 2. 成本达标：继续投放
 * 3. 成本不达标 + 失败次数未满：断掉重投
 * 4. 成本不达标 + 失败次数已满：换作品
 */
export function evaluateDelivery(context: RuleContext): RuleResult {
  const { thresholds, consecutiveFailures, currentSpent, currentLeads, currentCostPerLead } =
    context

  // 规则1: 消耗未达阈值，继续等待
  if (currentSpent < thresholds.minConsumption) {
    return {
      decision: 'continue',
      reason: `消耗 ${currentSpent.toFixed(2)} 元未达到检查阈值 ${thresholds.minConsumption} 元，继续监控`,
      shouldScheduleNextCheck: true,
      nextCheckMinutes: 30,
    }
  }

  // 规则2: 无转化
  if (currentLeads === 0) {
    if (consecutiveFailures >= thresholds.maxFailRetries - 1) {
      return {
        decision: 'switch_work',
        reason: `消耗 ${currentSpent.toFixed(2)} 元无转化，已连续失败 ${consecutiveFailures + 1} 次，需要换作品`,
        shouldScheduleNextCheck: false,
      }
    }
    return {
      decision: 'restart',
      reason: `消耗 ${currentSpent.toFixed(2)} 元无转化，断掉重投`,
      shouldScheduleNextCheck: false,
    }
  }

  // 规则3: 成本过高
  if (currentCostPerLead > thresholds.maxCostPerLead) {
    if (consecutiveFailures >= thresholds.maxFailRetries - 1) {
      return {
        decision: 'switch_work',
        reason: `单次咨询成本 ${currentCostPerLead.toFixed(2)} 元超过阈值 ${thresholds.maxCostPerLead} 元，已连续失败 ${consecutiveFailures + 1} 次，需要换作品`,
        shouldScheduleNextCheck: false,
      }
    }
    return {
      decision: 'restart',
      reason: `单次咨询成本 ${currentCostPerLead.toFixed(2)} 元超过阈值 ${thresholds.maxCostPerLead} 元，断掉重投`,
      shouldScheduleNextCheck: false,
    }
  }

  // 规则4: 效果达标，继续投放
  return {
    decision: 'continue',
    reason: `效果达标（成本 ${currentCostPerLead.toFixed(2)} 元 <= ${thresholds.maxCostPerLead} 元），继续投放`,
    shouldScheduleNextCheck: true,
    nextCheckMinutes: 60,
  }
}

/**
 * 计算效果评分 (0-100)
 */
export function calculatePerformanceScore(
  costPerLead: number,
  maxCostPerLead: number,
  leads: number
): number {
  if (leads === 0) return 0

  // 成本越低，分数越高
  const costScore = Math.max(0, 100 - (costPerLead / maxCostPerLead) * 50)

  // 转化数量加分
  const volumeBonus = Math.min(leads * 2, 20)

  return Math.min(100, costScore + volumeBonus)
}

/**
 * 判断是否应该切换作品
 */
export function shouldSwitchWork(
  consecutiveFailures: number,
  maxFailRetries: number
): boolean {
  return consecutiveFailures >= maxFailRetries
}

/**
 * 获取建议的下次检查时间（分钟）
 */
export function getNextCheckInterval(
  spent: number,
  minConsumption: number,
  isEffective: boolean
): number {
  // 消耗越少，检查越频繁
  if (spent < minConsumption / 2) {
    return 15
  }
  if (spent < minConsumption) {
    return 30
  }

  // 效果好，检查间隔可以长一些
  return isEffective ? 60 : 30
}
