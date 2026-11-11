/** 来店記録の整え方（仕様 6.2） */
import type { ContactLog, Customer, ID, ISODate, Visit } from './types'

/**
 * 1. 削除印つきと、日付が今日より後のものを除く。
 * 2. 日付の古い順（同じ日なら createdAt の古い順）に並べる。
 */
export function normalizeVisits(visits: readonly Visit[], today: ISODate): Visit[] {
  return visits
    .filter((v) => !v.deletedAt && v.date <= today)
    .slice()
    .sort((a, b) => (a.date === b.date ? compareStr(a.createdAt, b.createdAt) : compareStr(a.date, b.date)))
}

function compareStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** 最終来店＝日付が最も新しい記録。同じ日なら createdAt が新しいほう */
export function lastVisitOf(visits: readonly Visit[], today: ISODate): Visit | undefined {
  const n = normalizeVisits(visits, today)
  return n.length ? n[n.length - 1] : undefined
}

/** 日付が X 以前の来店記録のうち最新のもの（6.9 の lastVisitOn にも使う） */
export function lastVisitOnOrBefore(visits: readonly Visit[], x: ISODate): Visit | undefined {
  return lastVisitOf(visits, x)
}

/** 来店記録を顧客ごとに分ける（削除印つきは除く） */
export function groupVisitsByCustomer(visits: readonly Visit[]): Map<ID, Visit[]> {
  const map = new Map<ID, Visit[]>()
  for (const v of visits) {
    if (v.deletedAt) continue
    const list = map.get(v.customerId)
    if (list) list.push(v)
    else map.set(v.customerId, [v])
  }
  return map
}

/** 連絡記録を顧客ごとに分ける（削除印つきは除く） */
export function groupContactsByCustomer(contacts: readonly ContactLog[]): Map<ID, ContactLog[]> {
  const map = new Map<ID, ContactLog[]>()
  for (const c of contacts) {
    if (c.deletedAt) continue
    const list = map.get(c.customerId)
    if (list) list.push(c)
    else map.set(c.customerId, [c])
  }
  return map
}

/** 削除印のない顧客 */
export function activeCustomers(customers: readonly Customer[]): Customer[] {
  return customers.filter((c) => !c.deletedAt)
}

/** 同じ客・同じ日の記録（4.3「この日の記録がすでにあります」） */
export function findSameDayVisit(
  visits: readonly Visit[],
  customerId: ID,
  date: ISODate,
  excludeVisitId?: ID,
): Visit | undefined {
  return visits.find((v) => !v.deletedAt && v.customerId === customerId && v.date === date && v.id !== excludeVisitId)
}

/** 直近の来店（レシピメモの複製元など）。年月だけの記録も含む */
export function latestVisitWithRecipe(visits: readonly Visit[], today: ISODate): Visit | undefined {
  const n = normalizeVisits(visits, today)
  for (let i = n.length - 1; i >= 0; i--) {
    if (n[i].recipe?.text) return n[i]
  }
  return undefined
}
