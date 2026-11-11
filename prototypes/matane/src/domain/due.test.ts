import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { computeDue, computeDueInfo, status, statusAt, statusFromElapsed } from './due'
import { DEFAULT_THRESHOLDS } from './defaults'
import { MENUS, T, cust, settings, visit, visitsFromGaps } from '../test/factories'

const S = settings()

describe('6.4 次回の目安日（computeDue）', () => {
  it('L=2026-11-07、next = 予約 2026-12-19 → D=2026-12-19、booked', () => {
    const due = computeDue([visit('a', '2026-11-07', { next: { kind: 'booked', date: '2026-12-19' } })], MENUS, S, T)
    expect(due).toMatchObject({ dueDate: '2026-12-19', basis: 'booked', intervalDays: 42, elapsedDays: 0 })
  })

  it('L=2026-11-07、next = 目安6週 → D=2026-12-19、agreed', () => {
    const due = computeDue([visit('a', '2026-11-07', { next: { kind: 'agreed', amount: 6, unit: 'week' } })], MENUS, S, T)
    expect(due).toMatchObject({ dueDate: '2026-12-19', basis: 'agreed' })
  })

  it('L=2026-08-31、next = 目安2か月 → D=2026-10-31、agreed', () => {
    const due = computeDue([visit('a', '2026-08-31', { next: { kind: 'agreed', amount: 2, unit: 'month' } })], MENUS, S, T)
    expect(due).toMatchObject({ dueDate: '2026-10-31', basis: 'agreed' })
  })

  it('L=2026-12-31、next = 目安2か月 → D=2027-02-28、agreed', () => {
    const due = computeDue(
      [visit('a', '2026-12-31', { next: { kind: 'agreed', amount: 2, unit: 'month' } })],
      MENUS,
      S,
      '2027-01-05',
    )
    expect(due).toMatchObject({ dueDate: '2027-02-28', basis: 'agreed' })
  })

  it('おまかせ、周期56 → D=L+56、personal', () => {
    const vs = visitsFromGaps('a', [56, 56], '2026-09-01')
    const due = computeDue(vs, MENUS, S, T)
    expect(due).toMatchObject({ dueDate: addDays('2026-09-01', 56), basis: 'personal', personalCycleDays: 56 })
  })

  it('おまかせ、周期なし、メニュー［カット（なし）、白髪染め（42）］ → D=L+42、menu', () => {
    const due = computeDue([visit('a', '2026-10-01', { menuIds: ['cut', 'gray'] })], MENUS, S, T)
    expect(due).toMatchObject({ dueDate: addDays('2026-10-01', 42), basis: 'menu', basisMenuId: 'gray' })
  })

  it('おまかせ、周期なし、メニュー［カット（なし）］ → D=L+87、global', () => {
    const due = computeDue([visit('a', '2026-10-01', { menuIds: ['cut'] })], MENUS, S, T)
    expect(due).toMatchObject({ dueDate: addDays('2026-10-01', 87), basis: 'global', intervalDays: 87 })
  })

  it('同上で globalDefaultIntervalDays を 80 に変更 → D=L+80、global', () => {
    const due = computeDue([visit('a', '2026-10-01', { menuIds: ['cut'] })], MENUS, settings({ globalDefaultIntervalDays: 80 }), T)
    expect(due).toMatchObject({ dueDate: addDays('2026-10-01', 80), basis: 'global' })
  })

  it('予約 2026-11-04、bookingResolution=not_visited、周期60 → D=L+60、personal', () => {
    const vs = visitsFromGaps('a', [60, 60], '2026-09-26')
    const last = vs[vs.length - 1]
    last.next = { kind: 'booked', date: '2026-11-04' }
    last.bookingResolution = 'not_visited'
    const due = computeDue(vs, MENUS, S, T)
    expect(due).toMatchObject({ dueDate: addDays('2026-09-26', 60), basis: 'personal' })
  })

  it('来店記録がなければ null、none は 3 以降へ進む', () => {
    expect(computeDue([], MENUS, S, T)).toBeNull()
    const due = computeDue([visit('a', '2026-10-01', { menuIds: ['straight'], next: { kind: 'none' } })], MENUS, S, T)
    expect(due).toMatchObject({ basis: 'menu', intervalDays: 90 })
  })

  it('年月だけの最終来店も最終来店として使う（周期には使わない）', () => {
    const vs = [
      visit('a', '2026-03-01'),
      visit('a', '2026-05-01'),
      visit('a', '2026-07-31', { dateApprox: 'month', source: 'bulk', menuIds: ['straight'], next: { kind: 'none' } }),
    ]
    const due = computeDue(vs, MENUS, S, T)
    expect(due?.lastVisit.date).toBe('2026-07-31')
    expect(due?.personalCycleDays).toBe(61)
    expect(due).toMatchObject({ basis: 'personal', dueDate: addDays('2026-07-31', 61) })
  })
})

describe('6.5 区分の判定（status）', () => {
  const th = DEFAULT_THRESHOLDS
  const I60: Array<[number, string]> = [
    [50, 'not_yet'],
    [51, 'soon'],
    [60, 'soon'],
    [61, 'overdue'],
    [90, 'overdue'],
    [91, 'lapsed'],
    [365, 'lapsed'],
    [366, 'dormant'],
  ]

  it.each(I60)('I=60、E=%i → %s', (E, expected) => {
    expect(statusFromElapsed(E, 60, th)).toBe(expected)
    // 来店記録から（カラー＝メニューの目安 60日、来店1回）
    const c = cust('a')
    const v = visit('a', addDays(T, -E), { menuIds: ['color'] })
    expect(computeDueInfo(c, [v], MENUS, S, T)).toMatchObject({ intervalDays: 60, elapsedDays: E, status: expected })
  })

  const I42: Array<[number, string]> = [
    [35, 'not_yet'],
    [36, 'soon'],
    [42, 'soon'],
    [43, 'overdue'],
    [63, 'overdue'],
    [64, 'lapsed'],
  ]

  it.each(I42)('I=42、E=%i → %s', (E, expected) => {
    expect(statusFromElapsed(E, 42, th)).toBe(expected)
    const v = visit('a', addDays(T, -E), { menuIds: ['cut', 'gray'] })
    expect(status(cust('a'), [v], MENUS, S, T)).toBe(expected)
  })

  it('archived → archived（来店記録があっても）', () => {
    const c = cust('a', { archived: { on: '2026-10-01', reason: 'moved' } })
    expect(status(c, [visit('a', '2026-01-01')], MENUS, S, T)).toBe('archived')
    expect(status(c, [], MENUS, S, T)).toBe('archived')
  })

  it('来店記録がない → no_data', () => {
    expect(computeDueInfo(cust('a'), [], MENUS, S, T)).toEqual({ status: 'no_data' })
  })

  it('予約（未解決）: 予約日が先 → booked、今日 → today、過ぎた → confirm', () => {
    const mk = (date: string) => [visit('a', '2026-10-01', { next: { kind: 'booked', date } })]
    expect(status(cust('a'), mk('2026-11-20'), MENUS, S, T)).toBe('booked')
    expect(status(cust('a'), mk(T), MENUS, S, T)).toBe('today')
    expect(status(cust('a'), mk('2026-11-04'), MENUS, S, T)).toBe('confirm')
  })

  it('予約日を過ぎていても、1年を超えた予約は confirm のまま（3 が 4 より先）', () => {
    const vs = [visit('a', '2025-01-10', { next: { kind: 'booked', date: '2025-02-10' } })]
    expect(status(cust('a'), vs, MENUS, S, T)).toBe('confirm')
  })

  it('他の客の記録は使わない', () => {
    const vs = [visit('b', '2026-11-01'), visit('a', addDays(T, -70))]
    expect(computeDueInfo(cust('a'), vs, MENUS, S, T)).toMatchObject({ elapsedDays: 70, status: 'overdue' })
  })

  it('statusAt(S) は S 以前の記録だけで、今日 = S として判定する', () => {
    const vs = [...visitsFromGaps('a', [60, 60], '2026-06-30'), visit('a', '2026-10-03')]
    expect(statusAt(cust('a'), vs, MENUS, S, '2026-09-08')).toBe('overdue')
    expect(status(cust('a'), vs, MENUS, S, T)).toBe('not_yet')
  })
})
