import { describe, expect, it } from 'vitest'
import { confirmList, markNotVisited, todaysCustomers, unmarkNotVisited } from './today'
import { computeDueInfo } from './due'
import { MENUS, T, cust, settings, visit } from '../test/factories'

describe('6.7 今日のお客様・来た？の確認', () => {
  const customers = [
    cust('a', { nickname: 'もみじ' }),
    cust('b', { nickname: 'かえで' }),
    cust('c', { nickname: 'あおい' }),
    cust('d', { nickname: 'すずらん' }),
    cust('e', { nickname: 'いちょう' }),
    cust('f', { nickname: 'うめ' }),
  ]
  const visits = [
    // (a) 前回の予約が今日・未解決
    visit('a', '2026-09-26', { next: { kind: 'booked', date: T } }),
    // (b) 今日の来店記録がある
    visit('b', '2026-09-01'),
    visit('b', T),
    // (a) 予約が今日でも「来なかった」と確認済みなら出さない
    visit('c', '2026-09-26', { next: { kind: 'booked', date: T }, bookingResolution: 'not_visited' }),
    // 来た？の確認
    visit('d', '2026-10-03', { next: { kind: 'booked', date: '2026-11-04' } }),
    visit('e', '2026-10-01', { next: { kind: 'booked', date: '2026-11-01' } }),
    // 予約日が先
    visit('f', '2026-10-01', { next: { kind: 'booked', date: '2026-11-20' } }),
  ]

  it('今日のお客様: 「まだ」→「記録済み」、それぞれ呼び名順', () => {
    const list = todaysCustomers(customers, visits, T)
    expect(list.map((x) => [x.customer.nickname, x.recorded])).toEqual([
      ['もみじ', false],
      ['かえで', true],
    ])
    expect(list[0].previousVisit?.date).toBe('2026-09-26')
    expect(list[1].previousVisit?.date).toBe('2026-09-01')
    expect(list[1].todayVisit?.date).toBe(T)
  })

  it('予約の客を今日記録すると「記録済み」になる', () => {
    const list = todaysCustomers(customers, [...visits, visit('a', T)], T)
    expect(list.map((x) => [x.customer.nickname, x.recorded])).toEqual([
      ['かえで', true],
      ['もみじ', true],
    ])
  })

  it('来た？の確認: confirm の客を予約日の古い順', () => {
    const list = confirmList(customers, visits, MENUS, settings(), T)
    expect(list.map((x) => [x.customer.nickname, x.bookedDate])).toEqual([
      ['いちょう', '2026-11-01'],
      ['すずらん', '2026-11-04'],
    ])
  })

  it('［来なかった］で予約を流れたことにすると、確認待ちから外れ 6.4 の3以降で目安を出す', () => {
    const v = visits.find((x) => x.customerId === 'd')!
    const marked = markNotVisited(v, '2026-11-07T10:00:00Z')
    expect(marked.bookingResolution).toBe('not_visited')
    const others = visits.filter((x) => x.id !== v.id)
    const list = confirmList(customers, [...others, marked], MENUS, settings(), T)
    expect(list.map((x) => x.customer.nickname)).toEqual(['いちょう'])
    const due = computeDueInfo(customers[3], [marked], MENUS, settings(), T)
    expect(due.basis).toBe('menu')
    expect(due.status).toBe('not_yet')
    expect(unmarkNotVisited(marked, '2026-11-07T10:00:05Z').bookingResolution).toBeUndefined()
  })
})
