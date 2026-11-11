/** 次回の目安日（仕様 6.4）と区分の判定（仕様 6.5） */
import { addDays, addMonths, addWeeks, daysBetween } from './dates'
import { personalCycle } from './cycle'
import { bookingStatus, effectiveOpenBooking, hasOpenBooking, type OpenBooking } from './booking'
import { lastVisitOf } from './visits'
import type {
  CalcSettings,
  Customer,
  DueBasis,
  DueInfo,
  ID,
  ISODate,
  Menu,
  Settings,
  TimingStatus,
  Visit,
} from './types'

export interface DueCore {
  lastVisit: Visit
  dueDate: ISODate
  basis: DueBasis
  /** I = 目安日 − 最終来店日 */
  intervalDays: number
  /** E = 今日 − 最終来店日 */
  elapsedDays: number
  personalCycleDays: number | null
  personalIntervalsUsed: number
  /** basis が 'menu' のとき、目安に使ったメニュー */
  basisMenuId?: ID
  /** 有効な予約（なければ null） */
  booking: OpenBooking | null
}

/** 最終来店のメニューのうち、目安の日数がいちばん短いもの */
export function shortestIntervalMenu(menuIds: readonly ID[], menus: readonly Menu[]): Menu | undefined {
  let best: Menu | undefined
  for (const id of menuIds) {
    const m = menus.find((x) => x.id === id)
    if (!m || m.defaultIntervalDays == null || m.defaultIntervalDays <= 0) continue
    if (!best || m.defaultIntervalDays < (best.defaultIntervalDays as number)) best = m
  }
  return best
}

/** 目安（週・月）の日付 */
export function agreedDueDate(from: ISODate, amount: number, unit: 'week' | 'month'): ISODate {
  return unit === 'week' ? addWeeks(from, amount) : addMonths(from, amount)
}

/**
 * 次回の目安日（6.4）。来店記録がなければ null。
 * 優先: 1 予約（未解決）→ 2 会計時の目安 → 3 いつもの周期 → 4 メニューの目安 → 5 全体の目安
 * booking を渡すとそれを有効な予約として使う（effectiveOpenBooking の結果）。省略時は最後の来店記録の予約だけを見る。
 */
export function computeDue(
  visits: readonly Visit[],
  menus: readonly Menu[],
  settings: Pick<CalcSettings, 'globalDefaultIntervalDays'>,
  today: ISODate,
  booking?: OpenBooking | null,
): DueCore | null {
  const L = lastVisitOf(visits, today)
  if (!L) return null
  const open: OpenBooking | null =
    booking !== undefined ? booking : hasOpenBooking(L) ? { source: 'visit', date: L.next.date, visit: L } : null
  const cycle = personalCycle(visits, today)
  let dueDate: ISODate
  let basis: DueBasis
  let basisMenuId: ID | undefined
  if (open) {
    dueDate = open.date
    basis = 'booked'
  } else if (L.next.kind === 'agreed') {
    dueDate = agreedDueDate(L.date, L.next.amount, L.next.unit)
    basis = 'agreed'
  } else if (cycle.days != null) {
    dueDate = addDays(L.date, cycle.days)
    basis = 'personal'
  } else {
    const menu = shortestIntervalMenu(L.menuIds, menus)
    if (menu) {
      dueDate = addDays(L.date, menu.defaultIntervalDays as number)
      basis = 'menu'
      basisMenuId = menu.id
    } else {
      dueDate = addDays(L.date, settings.globalDefaultIntervalDays)
      basis = 'global'
    }
  }
  return {
    lastVisit: L,
    dueDate,
    basis,
    intervalDays: daysBetween(L.date, dueDate),
    elapsedDays: daysBetween(L.date, today),
    personalCycleDays: cycle.days,
    personalIntervalsUsed: cycle.intervalsUsed,
    basisMenuId,
    booking: open,
  }
}

/**
 * 経過日数と目安の間隔だけで決まる区分（6.5 の 4〜8）。割合は整数で比べる。
 */
export function statusFromElapsed(
  E: number,
  I: number,
  thresholds: Settings['thresholds'],
): 'dormant' | 'not_yet' | 'soon' | 'overdue' | 'lapsed' {
  if (E > thresholds.dormantDays) return 'dormant'
  if (100 * E < thresholds.soonPct * I) return 'not_yet'
  if (100 * E <= 100 * I) return 'soon'
  if (100 * E <= thresholds.lapsedPct * I) return 'overdue'
  return 'lapsed'
}

/** 区分の判定（6.5）。core は computeDue の結果 */
export function classifyStatus(
  core: DueCore | null,
  archived: boolean,
  thresholds: Settings['thresholds'],
  today: ISODate,
): TimingStatus {
  if (archived) return 'archived'
  if (!core) return 'no_data'
  if (core.booking) return bookingStatus(core.booking.date, today)
  return statusFromElapsed(core.elapsedDays, core.intervalDays, thresholds)
}

/** 顧客1人の目安と区分（DueInfo）。visits はその客の記録（他の客の記録が混ざっていても除く） */
export function computeDueInfo(
  customer: Customer,
  visits: readonly Visit[],
  menus: readonly Menu[],
  settings: Pick<CalcSettings, 'globalDefaultIntervalDays' | 'thresholds'>,
  today: ISODate,
): DueInfo {
  const own = visits.filter((v) => v.customerId === customer.id)
  const booking = effectiveOpenBooking(customer, own, today)
  const core = computeDue(own, menus, settings, today, booking)
  if (!core) {
    // 来店記録がなくても、あとから入れた予約があれば予約の区分にする
    if (customer.archived) return { status: 'archived' }
    if (booking) return { status: bookingStatus(booking.date, today), dueDate: booking.date, basis: 'booked', bookingSource: booking.source }
    return { status: 'no_data' }
  }
  const st = classifyStatus(core, !!customer.archived, settings.thresholds, today)
  return {
    status: st,
    lastVisit: core.lastVisit,
    dueDate: core.dueDate,
    basis: core.basis,
    ...(core.booking ? { bookingSource: core.booking.source } : {}),
    intervalDays: core.intervalDays,
    elapsedDays: core.elapsedDays,
    personalCycleDays: core.personalCycleDays,
    personalIntervalsUsed: core.personalIntervalsUsed,
  }
}

/** 区分（6.5） */
export function status(
  customer: Customer,
  visits: readonly Visit[],
  menus: readonly Menu[],
  settings: Pick<CalcSettings, 'globalDefaultIntervalDays' | 'thresholds'>,
  today: ISODate,
): TimingStatus {
  return computeDueInfo(customer, visits, menus, settings, today).status
}

/**
 * ある日 S の時点の区分（6.9）。日付が S 以前の来店記録だけを使い、今日 = S として 6.5 を当てる。
 * 管理者・連絡可否・リストから外したかは、計算時点の値を使う。
 */
export function statusAt(
  customer: Customer,
  visits: readonly Visit[],
  menus: readonly Menu[],
  settings: Pick<CalcSettings, 'globalDefaultIntervalDays' | 'thresholds'>,
  at: ISODate,
): TimingStatus {
  return status(customer, visits, menus, settings, at)
}

/** 声かけ候補になりうる区分（6.6 の a） */
export const CANDIDATE_STATUSES: readonly TimingStatus[] = ['soon', 'overdue', 'lapsed']

export function isCandidateStatus(s: TimingStatus): boolean {
  return CANDIDATE_STATUSES.includes(s)
}
