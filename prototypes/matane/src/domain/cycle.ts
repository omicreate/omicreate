/** いつもの周期（仕様 6.3） */
import { daysBetween } from './dates'
import { normalizeVisits } from './visits'
import type { ISODate, Visit } from './types'

export const MIN_GAP_DAYS = 7
export const MAX_GAP_DAYS = 365
export const MAX_GAPS_USED = 5

export interface PersonalCycle {
  /** 周期の日数（計算できなければ null） */
  days: number | null
  /** 使った間隔の数（0〜5） */
  intervalsUsed: number
}

/**
 * 間隔の並び（古い順）から周期を出す。
 * 7 ≤ g ≤ 365 だけを残し、新しいほうから最大5つの中央値を四捨五入する。
 */
export function cycleFromGaps(gaps: readonly number[]): PersonalCycle {
  const kept = gaps.filter((g) => g >= MIN_GAP_DAYS && g <= MAX_GAP_DAYS)
  const used = kept.slice(-MAX_GAPS_USED)
  if (used.length === 0) return { days: null, intervalsUsed: 0 }
  const sorted = [...used].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return { days: Math.round(median), intervalsUsed: used.length }
}

/** 年月だけの記録を除いた来店日を、重複なしで古い順に */
export function exactVisitDates(visits: readonly Visit[], today: ISODate): ISODate[] {
  const dates = normalizeVisits(visits, today)
    .filter((v) => !v.dateApprox)
    .map((v) => v.date)
  return [...new Set(dates)]
}

/** その客の来店記録から、いつもの周期とその計算に使った間隔の数 */
export function personalCycle(visits: readonly Visit[], today: ISODate): PersonalCycle {
  const dates = exactVisitDates(visits, today)
  const gaps: number[] = []
  for (let i = 0; i + 1 < dates.length; i++) gaps.push(daysBetween(dates[i], dates[i + 1]))
  return cycleFromGaps(gaps)
}

/** いつもの周期の日数（計算できなければ null） */
export function personalCycleDays(visits: readonly Visit[], today: ISODate): number | null {
  return personalCycle(visits, today).days
}
