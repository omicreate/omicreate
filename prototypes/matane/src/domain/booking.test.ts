/** あとから入れた予約（S10）: 有効な予約の判定と、今日のお客様・来た？・候補・ボードへの反映 */
import { describe, expect, it } from 'vitest'
import { bookingDatePhrase, bookingMonthDay, effectiveOpenBooking, isCustomerBookingActive, withBooking, withBookingResolution, withoutBooking } from './booking'
import { computeDueInfo, status } from './due'
import { eligibility } from './eligibility'
import { applyVisitToCustomer } from './records'
import { confirmList, todaysCustomers } from './today'
import { board } from './board'
import { dueBasisReason } from './templates'
import { localNoonISO } from './dates'
import { buildDemoData, SAMPLE_IDS } from '../data/demo'
import { MENUS, T, cust, settings, visit } from '../test/factories'
import type { Customer } from './types'

/** その日の正午に入れた予約 */
function booked(c: Customer, date: string, setOn: string = T): Customer {
  return { ...c, booking: { date, setAt: localNoonISO(setOn) } }
}

describe('有効な予約（effectiveOpenBooking）', () => {
  it('あとから入れた予約は、来店記録の次回の予約より優先する', () => {
    const c = booked(cust('a'), '2026-11-20')
    const vs = [visit('a', '2026-10-01', { next: { kind: 'booked', date: '2026-11-04' } })]
    expect(effectiveOpenBooking(c, vs, T)).toMatchObject({ source: 'customer', date: '2026-11-20' })
  })

  it('入れた日以降の来店記録があれば無効になり、来店記録の次回に戻る', () => {
    const c = booked(cust('a'), '2026-11-20', '2026-11-01')
    const vs = [
      visit('a', '2026-10-01'),
      visit('a', '2026-11-05', { next: { kind: 'booked', date: '2026-12-10' } }),
    ]
    expect(isCustomerBookingActive(c, vs, T)).toBe(false)
    expect(effectiveOpenBooking(c, vs, T)).toMatchObject({ source: 'visit', date: '2026-12-10' })
  })

  it('同じ日の来店記録でも、予約を入れる前に記録したものなら予約は有効（会計のあとで入った予約）', () => {
    const c = { ...cust('a'), booking: { date: '2026-12-05', setAt: '2026-11-07T11:00:00.000Z' } }
    const before = visit('a', T, { createdAt: '2026-11-07T05:00:00.000Z', next: { kind: 'agreed', amount: 4, unit: 'week' } })
    expect(effectiveOpenBooking(c, [before], T)).toMatchObject({ source: 'customer', date: '2026-12-05' })
    const after = visit('a', T, { createdAt: '2026-11-07T12:00:00.000Z' })
    expect(effectiveOpenBooking(c, [after], T)).toBeNull()
  })

  it('入れた日が計算の日より後（ボードで過去の日を見るとき）は数えない', () => {
    const c = booked(cust('a'), '2026-11-20', T)
    expect(effectiveOpenBooking(c, [], '2026-11-01')).toBeNull()
  })

  it('予約がなければ、従来どおり最後の来店記録の次回の予約（未解決のもの）', () => {
    const c = cust('a')
    expect(effectiveOpenBooking(c, [visit('a', '2026-10-01', { next: { kind: 'booked', date: '2026-11-04' } })], T)).toMatchObject({
      source: 'visit',
      date: '2026-11-04',
    })
    expect(
      effectiveOpenBooking(c, [visit('a', '2026-10-01', { next: { kind: 'booked', date: '2026-11-04' }, bookingResolution: 'not_visited' })], T),
    ).toBeNull()
    expect(effectiveOpenBooking(c, [], T)).toBeNull()
  })

  it('壊れた予約は無視する', () => {
    const c = { ...cust('a'), booking: { date: '2026-13-01', setAt: localNoonISO(T) } }
    expect(effectiveOpenBooking(c, [], T)).toBeNull()
  })

  it('withBooking・withoutBooking', () => {
    const c = withBooking(cust('a'), '2026-11-20', '2026-11-07T01:00:00.000Z')
    expect(c.booking).toEqual({ date: '2026-11-20', setAt: '2026-11-07T01:00:00.000Z' })
    expect('booking' in withoutBooking(c, '2026-11-07T02:00:00.000Z')).toBe(false)
  })
})

describe('区分への反映（due）', () => {
  const s = settings()
  it('予約日 > 今日 → booked（来店記録のない客でも）', () => {
    const c = booked(cust('new'), '2026-11-20')
    expect(computeDueInfo(c, [], MENUS, s, T)).toMatchObject({ status: 'booked', dueDate: '2026-11-20', basis: 'booked', bookingSource: 'customer' })
  })

  it('予約日 = 今日 → today、< 今日 → confirm', () => {
    expect(status(booked(cust('a'), T, '2026-11-01'), [], MENUS, s, T)).toBe('today')
    expect(status(booked(cust('a'), '2026-11-05', '2026-11-01'), [], MENUS, s, T)).toBe('confirm')
  })

  it('来店記録のある客: 予約で目安日を上書きし、根拠は「あとから入れた予約日」', () => {
    const c = booked(cust('a'), '2026-11-20')
    const vs = [visit('a', '2026-05-01')]
    const due = computeDueInfo(c, vs, MENUS, s, T)
    expect(due).toMatchObject({ status: 'booked', dueDate: '2026-11-20', bookingSource: 'customer' })
    expect(due.lastVisit?.date).toBe('2026-05-01')
    expect(dueBasisReason(due, MENUS, s)).toBe('あとから入れた予約日')
  })

  it('リストから外した客は archived のまま', () => {
    const c = { ...booked(cust('a'), '2026-11-20'), archived: { on: T, reason: 'moved' as const } }
    expect(status(c, [], MENUS, s, T)).toBe('archived')
  })
})

describe('今日のお客様・来た？・候補への反映', () => {
  const s = settings()

  it('予約日が今日なら、来店記録のない新しいお客様も今日のお客様に出る（前回はなし）', () => {
    const c = booked(cust('sakura', { nickname: 'さくら' }), T, '2026-11-06')
    const list = todaysCustomers([c], [], T)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ recorded: false })
    expect(list[0].previousVisit).toBeUndefined()
  })

  it('あとから入れた予約で日付を変えたら、来店記録の予約日（今日）には出さない', () => {
    const c = booked(cust('a'), '2026-11-20', '2026-11-01')
    const vs = [visit('a', '2026-09-26', { next: { kind: 'booked', date: T } })]
    expect(todaysCustomers([c], vs, T)).toHaveLength(0)
    expect(todaysCustomers([c], vs, '2026-11-20')).toHaveLength(1)
  })

  it('予約日を過ぎて来店記録がなければ来た？に出る（出どころ customer、来店記録なし）', () => {
    const c = booked(cust('sakura', { nickname: 'さくら' }), '2026-11-08', T)
    const list = confirmList([c], [], MENUS, s, '2026-11-09')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ bookedDate: '2026-11-08', booking: { source: 'customer' } })
    expect(list[0].visit).toBeUndefined()
  })

  it('来店記録由来の来た？は visit を持つ', () => {
    const list = confirmList([cust('d')], [visit('d', '2026-10-03', { next: { kind: 'booked', date: '2026-11-04' } })], MENUS, s, T)
    expect(list[0].booking.source).toBe('visit')
    expect(list[0].visit?.date).toBe('2026-10-03')
  })

  it('サンプル: つばきに 11/20 の予約を入れると候補から消え、11/20 に今日のお客様に出る', () => {
    const demo = buildDemoData(T, '2026-11-07T01:00:00.000Z')
    const before = eligibility({ ...demo, settings: demo.settings as never, today: T })
    expect(before.candidates.map((c) => c.customer.nickname)).toEqual(['つばき', 'ゆず', 'ひいらぎ', 'かりん'])
    const customers = demo.customers.map((c) => (c.id === SAMPLE_IDS.tsubaki ? booked(c, '2026-11-20') : c))
    const after = eligibility({ ...demo, customers, settings: demo.settings as never, today: T })
    expect(after.candidates.map((c) => c.customer.nickname)).toEqual(['ゆず', 'ひいらぎ', 'かりん'])
    expect(after.dueById.get(SAMPLE_IDS.tsubaki)?.status).toBe('booked')
    expect(todaysCustomers(customers, demo.visits, '2026-11-20').map((t) => t.customer.nickname)).toContain('つばき')
  })

  it('ボードの「次回の約束あり」は来店記録の next で数えるまま（あとから入れた予約は数えない）', () => {
    const demo = buildDemoData(T, '2026-11-07T01:00:00.000Z')
    const base = board({ ...demo, settings: demo.settings as never, today: T })
    const customers = demo.customers.map((c) => (c.id === SAMPLE_IDS.tsubaki ? booked(c, '2026-11-20') : c))
    const after = board({ ...demo, customers, settings: demo.settings as never, today: T })
    expect(JSON.stringify(after.promise ?? null)).toBe(JSON.stringify(base.promise ?? null))
  })
})

describe('予約の片付け（来店の保存）', () => {
  const now = '2026-11-08T03:00:00.000Z'
  it('入れた日以降の来店を保存すると予約を消す', () => {
    const c = booked(cust('a'), '2026-11-20', T)
    const r = applyVisitToCustomer(c, { today: '2026-11-08', now, visitDate: '2026-11-08' })
    expect(r.bookingCleared).toBe(true)
    expect(r.changed).toBe(true)
    expect(r.customer.booking).toBeUndefined()
  })

  it('入れた日より前の来店（過去の記録の追加）や、記録の手直しでは消さない', () => {
    const c = booked(cust('a'), '2026-11-20', T)
    expect(applyVisitToCustomer(c, { today: T, now, visitDate: '2026-10-01' }).customer.booking).toBeDefined()
    expect(applyVisitToCustomer(c, { today: T, now, visitDate: T, editing: true }).customer.booking).toBeDefined()
  })
})

describe('会計時の予約を片付けた印（replaced / cancelled）', () => {
  it('サンプルのすずらん: 11/4 の予約を「予約日を変えた」にして予約を入れ、取り消しても来た？に戻らない。ボードの数え方は変わらない', () => {
    const demo = buildDemoData(T, '2026-11-07T01:00:00.000Z')
    const suzuran = demo.customers.find((c) => c.id === SAMPLE_IDS.suzuran)!
    const open = effectiveOpenBooking(suzuran, demo.visits, T)
    expect(open).toMatchObject({ source: 'visit', date: '2026-11-04' })
    if (open?.source !== 'visit') throw new Error('会計時の予約がない')
    const now = '2026-11-07T02:00:00.000Z'
    const visits = demo.visits.map((v) => (v.id === open.visit.id ? withBookingResolution(v, 'replaced', now) : v))
    const changed = withBooking(suzuran, '2026-11-20', now)
    const customers = demo.customers.map((c) => (c.id === suzuran.id ? changed : c))
    expect(confirmList(customers, visits, MENUS, settings(), T).map((x) => x.customer.id)).not.toContain(suzuran.id)
    const cancelled = customers.map((c) => (c.id === suzuran.id ? withoutBooking(c, now) : c))
    expect(effectiveOpenBooking(withoutBooking(changed, now), visits, T)).toBeNull()
    expect(confirmList(cancelled, visits, MENUS, settings(), T).map((x) => x.customer.id)).not.toContain(suzuran.id)
    expect(board({ ...demo, customers: cancelled, visits, settings: demo.settings as never, today: T }).promise).toEqual(
      board({ ...demo, settings: demo.settings as never, today: T }).promise,
    )
  })

  it('cancelled の来店記録の予約も有効な予約にならない', () => {
    const v = visit('a', '2026-10-01', { next: { kind: 'booked', date: '2026-11-20' } })
    expect(effectiveOpenBooking(cust('a'), [withBookingResolution(v, 'cancelled', T + 'T00:00:00.000Z')], T)).toBeNull()
  })
})

describe('予約日の表示（年が違えば年をつける）', () => {
  it.each([
    ['2026-11-20', '11月20日（金）', '11月20日'],
    ['2027-01-10', '2027年1月10日（日）', '2027年1月10日'],
  ])('%s → %s', (d, phrase, md) => {
    expect(bookingDatePhrase(d, T)).toBe(phrase)
    expect(bookingMonthDay(d, T)).toBe(md)
  })
})
