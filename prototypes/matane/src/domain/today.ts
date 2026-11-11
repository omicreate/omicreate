/** 今日のお客様・来た？の確認（仕様 6.7） */
import { addDays } from './dates'
import { effectiveOpenBooking, type OpenBooking } from './booking'
import { computeDueInfo } from './due'
import { compareNames } from './text'
import { groupVisitsByCustomer, lastVisitOf, normalizeVisits } from './visits'
import type { CalcSettings, Customer, DueInfo, ISODate, ISODateTime, Menu, Visit } from './types'

export interface TodayCustomer {
  customer: Customer
  /** 今日の来店記録がある（「記録済み」） */
  recorded: boolean
  /** 今日より前の最新の来店（前回の日付・メニュー・メモの1行目を出す） */
  previousVisit?: Visit
  /** 今日の来店記録（記録済みのとき） */
  todayVisit?: Visit
}

/**
 * 今日のお客様（6.7）:
 *  (a) 有効な予約（effectiveOpenBooking。あとから入れた予約を含む）の日付が T、または
 *  (b) 日付が T の来店記録がある
 * 来店記録のない客でも、予約が T なら出す（previousVisit はなし）。
 * 並びは「まだ」→「記録済み」、それぞれ呼び名順。
 */
export function todaysCustomers(
  customers: readonly Customer[],
  visits: readonly Visit[],
  today: ISODate,
): TodayCustomer[] {
  const visitsBy = groupVisitsByCustomer(visits)
  const out: TodayCustomer[] = []
  for (const customer of customers) {
    if (customer.deletedAt) continue
    const own = normalizeVisits(visitsBy.get(customer.id) ?? [], today)
    const before = own.filter((v) => v.date < today)
    const previousVisit = before.length ? before[before.length - 1] : undefined
    const todays = own.filter((v) => v.date === today)
    const todayVisit = todays.length ? todays[todays.length - 1] : undefined
    const booking = effectiveOpenBooking(customer, own, today)
    const bookedToday = booking?.date === today
    if (todayVisit || bookedToday) {
      out.push({ customer, recorded: !!todayVisit, previousVisit, todayVisit })
    }
  }
  out.sort((a, b) => {
    if (a.recorded !== b.recorded) return a.recorded ? 1 : -1
    return compareNames(a.customer, b.customer)
  })
  return out
}

export interface ConfirmItem {
  customer: Customer
  due: DueInfo
  /** 予約日（過ぎている） */
  bookedDate: ISODate
  /** 予約の出どころ（「来なかった」で、来店記録なら bookingResolution を付け、あとから入れた予約なら消す） */
  booking: OpenBooking
  /** 予約日を入れた来店記録（会計時に入れた予約のとき） */
  visit?: Visit
}

/**
 * 来た？の確認（6.7）: status = 'confirm' の顧客（来店記録のない客の、あとから入れた予約も含む）。
 * 並びは予約日の古い順（同じなら呼び名順）。
 */
export function confirmList(
  customers: readonly Customer[],
  visits: readonly Visit[],
  menus: readonly Menu[],
  settings: Pick<CalcSettings, 'globalDefaultIntervalDays' | 'thresholds'>,
  today: ISODate,
): ConfirmItem[] {
  const visitsBy = groupVisitsByCustomer(visits)
  const out: ConfirmItem[] = []
  for (const customer of customers) {
    if (customer.deletedAt) continue
    const own = visitsBy.get(customer.id) ?? []
    const due = computeDueInfo(customer, own, menus, settings, today)
    if (due.status !== 'confirm') continue
    const booking = effectiveOpenBooking(customer, own, today)
    if (!booking) continue
    out.push({ customer, due, bookedDate: booking.date, booking, ...(booking.source === 'visit' ? { visit: booking.visit } : {}) })
  }
  out.sort((a, b) => {
    if (a.bookedDate !== b.bookedDate) return a.bookedDate < b.bookedDate ? -1 : 1
    return compareNames(a.customer, b.customer)
  })
  return out
}

/** ［来なかった］: 最終来店の記録に bookingResolution = 'not_visited' を付けた新しい記録を返す */
export function markNotVisited(visit: Visit, now: ISODateTime): Visit {
  return { ...visit, bookingResolution: 'not_visited', updatedAt: now }
}

/** ［来なかった］の取り消し */
export function unmarkNotVisited(visit: Visit, now: ISODateTime): Visit {
  const { bookingResolution: _ignored, ...rest } = visit
  void _ignored
  return { ...rest, updatedAt: now }
}

/** まとめ記録（4.4）の対象日の一覧: その日に予約が入っていた人と、その日に記録した人 */
export function batchTargets(
  customers: readonly Customer[],
  visits: readonly Visit[],
  date: ISODate,
): TodayCustomer[] {
  return todaysCustomers(customers, visits, date)
}

/** 「昨日の分」の日付 */
export function yesterdayOf(today: ISODate): ISODate {
  return addDays(today, -1)
}

/** その客の今日より前の最新の来店（［来た］で「前回と同じ」メニューを入れるときに使う） */
export function previousVisitOf(visits: readonly Visit[], customerId: string, beforeOrOn: ISODate): Visit | undefined {
  return lastVisitOf(
    visits.filter((v) => v.customerId === customerId),
    beforeOrOn,
  )
}
