/** わたしの再来ボード（仕様 6.9）。金額換算・率・業界比較は出さない */
import { addDays, daysBetween, endOfPreviousMonth, localDateOf, monthKey, addMonthsToKey } from './dates'
import { statusAt } from './due'
import { koekakeLogs } from './eligibility'
import { groupContactsByCustomer, groupVisitsByCustomer, lastVisitOnOrBefore } from './visits'
import type { CalcSettings, ContactLog, Customer, ID, ISODate, LocalCounters, Menu, Settings, Visit } from './types'

type BoardSettings = Pick<CalcSettings, 'globalDefaultIntervalDays' | 'thresholds' | 'compareWindowDays'>

export interface BoardInput {
  customers: readonly Customer[]
  visits: readonly Visit[]
  contacts: readonly ContactLog[]
  menus: readonly Menu[]
  settings: BoardSettings
  today: ISODate
}

/** 日付が X 以前の来店記録のうち最新の日付 */
export function lastVisitOn(visits: readonly Visit[], x: ISODate): ISODate | undefined {
  return lastVisitOnOrBefore(visits, x)?.date
}

/** 1) 稼働顧客（X の時点）: 削除・archived でなく、X 以前の最終来店から dormantDays 以内の顧客 */
export function activeCustomerIds(
  customers: readonly Customer[],
  visits: readonly Visit[],
  dormantDays: number,
  x: ISODate,
): ID[] {
  const by = groupVisitsByCustomer(visits)
  const ids: ID[] = []
  for (const c of customers) {
    if (c.deletedAt || c.archived) continue
    const last = lastVisitOn(by.get(c.id) ?? [], x)
    if (last && daysBetween(last, x) <= dormantDays) ids.push(c.id)
  }
  return ids
}

export function activeCustomerCount(
  customers: readonly Customer[],
  visits: readonly Visit[],
  dormantDays: number,
  x: ISODate,
): number {
  return activeCustomerIds(customers, visits, dormantDays, x).length
}

export interface PromiseCount {
  /** 'YYYY-MM' */
  month: string
  /** n: その月の来店記録（ざっくり登録を除く） */
  total: number
  /** k: 次回の約束あり（予約か目安） */
  kept: number
  /** b: 予約 */
  booked: number
  /** a: 目安 */
  agreed: number
  visitIds: ID[]
  customerIds: ID[]
}

/** 2) 次回の約束あり（月 M） */
export function promiseCount(
  customers: readonly Customer[],
  visits: readonly Visit[],
  month: string,
  today: ISODate,
): PromiseCount {
  const alive = new Set(customers.filter((c) => !c.deletedAt).map((c) => c.id))
  const vm = visits.filter(
    (v) => !v.deletedAt && v.source !== 'bulk' && v.date <= today && monthKey(v.date) === month && alive.has(v.customerId),
  )
  const booked = vm.filter((v) => v.next.kind === 'booked').length
  const agreed = vm.filter((v) => v.next.kind === 'agreed').length
  return {
    month,
    total: vm.length,
    kept: booked + agreed,
    booked,
    agreed,
    visitIds: vm.map((v) => v.id),
    customerIds: [...new Set(vm.map((v) => v.customerId))],
  }
}

export interface KoekakeGroup {
  count: number
  returned: number
  customerIds: ID[]
  returnedIds: ID[]
}

export interface KoekakeReturn {
  windowDays: number
  /** S = T − W */
  since: ISODate
  /** A: 期間内に声かけした人 */
  contacted: KoekakeGroup
  /** B: 声かけしなかったご無沙汰の人 */
  notContacted: KoekakeGroup
}

/** 3) 声かけと戻り（直近 W 日） */
export function koekakeAndReturn(input: BoardInput): KoekakeReturn {
  const { customers, visits, contacts, menus, settings, today } = input
  const W = settings.compareWindowDays
  const S = addDays(today, -W)
  const visitsBy = groupVisitsByCustomer(visits)
  const contactsBy = groupContactsByCustomer(contacts)
  const hasVisitIn = (cid: ID, afterExclusive: ISODate) =>
    (visitsBy.get(cid) ?? []).some((v) => v.date > afterExclusive && v.date <= today)

  const aIds: ID[] = []
  const aReturned: ID[] = []
  const inA = new Set<ID>()
  for (const c of customers) {
    if (c.deletedAt) continue
    const logs = koekakeLogs(contactsBy.get(c.id) ?? [], today).filter((l) => l.date > S)
    if (logs.length === 0) continue
    inA.add(c.id)
    aIds.push(c.id)
    if (hasVisitIn(c.id, logs[0].date)) aReturned.push(c.id)
  }

  const bIds: ID[] = []
  const bReturned: ID[] = []
  for (const c of customers) {
    if (c.deletedAt || c.archived || inA.has(c.id)) continue
    if (c.stewardship.steward !== 'self' || c.contact.permission === 'no') continue
    const st = statusAt(c, visitsBy.get(c.id) ?? [], menus, settings, S)
    if (st !== 'overdue' && st !== 'lapsed') continue
    bIds.push(c.id)
    if (hasVisitIn(c.id, S)) bReturned.push(c.id)
  }

  return {
    windowDays: W,
    since: S,
    contacted: { count: aIds.length, returned: aReturned.length, customerIds: aIds, returnedIds: aReturned },
    notContacted: { count: bIds.length, returned: bReturned.length, customerIds: bIds, returnedIds: bReturned },
  }
}

export interface BoardResult {
  active: { now: number; lastMonthEnd: number; lastMonthEndDate: ISODate; nowIds: ID[]; lastMonthEndIds: ID[] } | null
  promise: { thisMonth: PromiseCount; lastMonth: PromiseCount } | null
  koekake: KoekakeReturn | null
  /** 来店記録が1件もない（「来店を記録すると、ここに数字が出ます」） */
  empty: boolean
}

function safe<T>(f: () => T): T | null {
  try {
    return f()
  } catch {
    return null
  }
}

/** ボードの3つの数字。計算に失敗した数字だけ null（「計算できませんでした」） */
export function board(input: BoardInput): BoardResult {
  const { customers, visits, settings, today } = input
  const lastMonthEndDate = endOfPreviousMonth(today)
  const active = safe(() => {
    const nowIds = activeCustomerIds(customers, visits, settings.thresholds.dormantDays, today)
    const lastIds = activeCustomerIds(customers, visits, settings.thresholds.dormantDays, lastMonthEndDate)
    return { now: nowIds.length, lastMonthEnd: lastIds.length, lastMonthEndDate, nowIds, lastMonthEndIds: lastIds }
  })
  const promise = safe(() => {
    const m = monthKey(today)
    return {
      thisMonth: promiseCount(customers, visits, m, today),
      lastMonth: promiseCount(customers, visits, addMonthsToKey(m, -1), today),
    }
  })
  const koekake = safe(() => koekakeAndReturn(input))
  const empty = !visits.some((v) => !v.deletedAt)
  return { active, promise, koekake, empty }
}

/* ========== 表示の文字列 ========== */

export function activeText(n: number): string {
  return `${n}人（最終来店が1年以内）`
}

export function lastMonthActiveText(n: number): string {
  return `先月末 ${n}人`
}

/** 「n件中k件（予約b・目安a）」。0件の内訳は省く。n = 0 なら「記録なし」 */
export function promiseText(p: PromiseCount): string {
  if (p.total === 0) return '記録なし'
  const parts: string[] = []
  if (p.booked > 0) parts.push(`予約${p.booked}`)
  if (p.agreed > 0) parts.push(`目安${p.agreed}`)
  return `${p.total}件中${p.kept}件${parts.length ? `（${parts.join('・')}）` : ''}`
}

export function contactedText(g: KoekakeGroup): string {
  return `声かけした人 ${g.count}人 → その後来店 ${g.returned}人`
}

export function notContactedText(g: KoekakeGroup): string {
  return `声かけしなかったご無沙汰の人 ${g.count}人 → その後来店 ${g.returned}人`
}

/**
 * ［数字をコピー（名前は含まない）］の文字列（4.8）。呼び名・メモは一切含めない。
 */
export function boardCopyText(input: {
  board: BoardResult
  visits: readonly Visit[]
  counters: LocalCounters
  settings: Pick<Settings, 'lastBackupAt'>
  today: ISODate
}): string {
  const { board: b, visits, counters, settings, today } = input
  const from = addDays(today, -28)
  const recent = visits.filter((v) => !v.deletedAt && v.source !== 'bulk' && v.date > from && v.date <= today).length
  const lines: string[] = [`またね帳の数字（${today}）`]
  lines.push(
    b.active
      ? `稼働顧客数: ${b.active.now}人（先月末 ${b.active.lastMonthEnd}人）`
      : '稼働顧客数: 計算できませんでした',
  )
  lines.push(
    b.promise
      ? `次回の約束あり: 今月 ${promiseText(b.promise.thisMonth)}／先月 ${promiseText(b.promise.lastMonth)}`
      : '次回の約束あり: 計算できませんでした',
  )
  lines.push(
    b.koekake
      ? `声かけと戻り（直近${b.koekake.windowDays}日）: 声かけした人 ${b.koekake.contacted.count}人→来店 ${b.koekake.contacted.returned}人／しなかったご無沙汰の人 ${b.koekake.notContacted.count}人→来店 ${b.koekake.notContacted.returned}人`
      : '声かけと戻り: 計算できませんでした',
  )
  lines.push(`直近28日の来店記録: ${recent}件`)
  lines.push(`声かけ（累計）: ${counters.koekakeSent}件`)
  lines.push(`見送り（累計）: ${counters.koekakeSkipped}件`)
  lines.push(`実は来ていた（累計）: ${counters.actuallyVisitedFixes}回`)
  lines.push(`使い始めた日: ${counters.firstUsedOn}`)
  lines.push(`最後のバックアップ: ${settings.lastBackupAt ? localDateOf(settings.lastBackupAt) : 'まだしていません'}`)
  return lines.join('\n')
}
