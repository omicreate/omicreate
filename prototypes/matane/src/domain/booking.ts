/**
 * 有効な予約（S10「予約を入れる」）。予約の出どころは2つ:
 *  - あとから入れた予約（customer.booking）: 美容師が自分で手入力した日付
 *  - 会計時に入れた予約（最後の来店記録の next が booked）
 * どの画面・計算も、予約を見るときはこのファイルの effectiveOpenBooking を使う。
 */
import { formatMonthDayJa, isValidISODate, localDateOf, parseISODate, weekdayJa } from './dates'
import { normalizeVisits } from './visits'
import type { BookingResolution, Customer, CustomerBooking, ISODate, ISODateTime, Visit } from './types'

/** 来店記録の予約が未解決か（予約日があり、「来なかった」と確認していない） */
export function hasOpenBooking(v: Visit | undefined): v is Visit & { next: { kind: 'booked'; date: ISODate } } {
  return !!v && v.next.kind === 'booked' && !v.bookingResolution
}

export type OpenBooking =
  | { source: 'customer'; date: ISODate; setAt: ISODateTime }
  | { source: 'visit'; date: ISODate; visit: Visit & { next: { kind: 'booked'; date: ISODate } } }

/** 予約を入れた日（端末の日付） */
export function bookingSetOn(b: CustomerBooking): ISODate {
  return localDateOf(b.setAt)
}

/** この来店記録が、あとから入れた予約より後の来店か（入れた日より後の日付、または同じ日で予約を入れたあとに記録したもの） */
export function visitSupersedesBooking(v: Pick<Visit, 'date' | 'createdAt'>, b: CustomerBooking): boolean {
  const setOn = bookingSetOn(b)
  if (v.date > setOn) return true
  return v.date === setOn && v.createdAt >= b.setAt
}

/**
 * あとから入れた予約が今も有効か。
 * 入れた日が today より後（ボードで過去の日を計算するときなど）や、入れたあとの来店記録があれば無効。
 */
export function isCustomerBookingActive(customer: Customer, visits: readonly Visit[], today: ISODate): boolean {
  const b = customer.booking
  if (!b || !isValidISODate(b.date) || typeof b.setAt !== 'string') return false
  let setOn: ISODate
  try {
    setOn = bookingSetOn(b)
  } catch {
    return false
  }
  if (!isValidISODate(setOn) || setOn > today) return false
  return !normalizeVisits(
    visits.filter((v) => v.customerId === customer.id),
    today,
  ).some((v) => visitSupersedesBooking(v, b))
}

/**
 * 有効な予約（1つだけ）:
 *  1. customer.booking があり、入れたあとの来店記録がなければそれ（来店記録の next より優先）
 *  2. なければ、最後の来店記録の next が予約で、「来なかった」にしていないもの
 * visits はその客の記録（ほかの客の記録が混ざっていても除く）。
 */
export function effectiveOpenBooking(customer: Customer, visits: readonly Visit[], today: ISODate): OpenBooking | null {
  const own = normalizeVisits(
    visits.filter((v) => v.customerId === customer.id),
    today,
  )
  if (customer.booking && isCustomerBookingActive(customer, own, today)) {
    return { source: 'customer', date: customer.booking.date, setAt: customer.booking.setAt }
  }
  const L = own.length ? own[own.length - 1] : undefined
  if (hasOpenBooking(L)) return { source: 'visit', date: L.next.date, visit: L }
  return null
}

/** 予約日と今日から区分: 先＝booked、今日＝today、過ぎた＝confirm（来た？） */
export function bookingStatus(date: ISODate, today: ISODate): 'booked' | 'today' | 'confirm' {
  if (date > today) return 'booked'
  if (date === today) return 'today'
  return 'confirm'
}

/** あとから入れた予約を付けた顧客 */
export function withBooking(customer: Customer, date: ISODate, now: ISODateTime): Customer {
  return { ...customer, booking: { date, setAt: now }, updatedAt: now }
}

/** あとから入れた予約を外した顧客 */
export function withoutBooking(customer: Customer, now: ISODateTime): Customer {
  const { booking: _b, ...rest } = customer
  void _b
  return { ...rest, updatedAt: now }
}

/** 来店記録の予約を片付けた記録（来なかった／別の日に変えた／取り消した） */
export function withBookingResolution(visit: Visit, resolution: BookingResolution, now: ISODateTime): Visit {
  return { ...visit, bookingResolution: resolution, updatedAt: now }
}

/** 来店記録の欄に添える、予約を片付けた理由 */
export function bookingResolutionLabel(r: BookingResolution | undefined): string {
  switch (r) {
    case 'not_visited':
      return '来なかった'
    case 'replaced':
      return '予約日を変えた'
    case 'cancelled':
      return '取り消した'
    default:
      return ''
  }
}

/** 予約日の表示: 「11月20日（金）」。今年でなければ「2027年1月10日（日）」と年をつける */
export function bookingDatePhrase(d: ISODate, today: ISODate): string {
  const y = parseISODate(d).y
  const head = y === parseISODate(today).y ? '' : `${y}年`
  return `${head}${formatMonthDayJa(d)}（${weekdayJa(d)}）`
}

/** 予約日の短い表示（「11月4日」。今年でなければ年をつける） */
export function bookingMonthDay(d: ISODate, today: ISODate): string {
  const y = parseISODate(d).y
  return `${y === parseISODate(today).y ? '' : `${y}年`}${formatMonthDayJa(d)}`
}
