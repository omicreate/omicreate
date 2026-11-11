import { describe, expect, it } from 'vitest'
import { LAST_VISIT_ERROR, parseLastVisitInput } from './lastVisitInput'

const T = '2026-11-07'

describe('6.12 ざっくり登録の最終来店（parseLastVisitInput）', () => {
  it.each(['8月', '2026-08', '2026/8', '2026年8月', '８月'])('%s → 2026-08-31、おおよそ', (input) => {
    expect(parseLastVisitInput(input, T)).toEqual({ kind: 'date', date: '2026-08-31', approx: true })
  })

  it('11月 → 2026-11-07、おおよそ（当月は今日）', () => {
    expect(parseLastVisitInput('11月', T)).toEqual({ kind: 'date', date: '2026-11-07', approx: true })
  })

  it('12月 → 2025-12-31、おおよそ（今日より後の月は前年）', () => {
    expect(parseLastVisitInput('12月', T)).toEqual({ kind: 'date', date: '2025-12-31', approx: true })
  })

  it.each(['8/22', '2026/8/22', '2026-08-22', '8月22日'])('%s → 2026-08-22、正確', (input) => {
    expect(parseLastVisitInput(input, T)).toEqual({ kind: 'date', date: '2026-08-22', approx: false })
  })

  it('12/1 → 2025-12-01、正確（今日より後の日付は前年）', () => {
    expect(parseLastVisitInput('12/1', T)).toEqual({ kind: 'date', date: '2025-12-01', approx: false })
  })

  it.each(['', '不明', '  '])('「%s」→ 来店記録を作らない', (input) => {
    expect(parseLastVisitInput(input, T)).toEqual({ kind: 'empty' })
  })

  it.each(['13月', '2026-13', '2/30', '2027-01', '2026-12-01', 'きのう'])('%s → エラー「読み取れませんでした」', (input) => {
    expect(parseLastVisitInput(input, T)).toEqual({ kind: 'error', message: LAST_VISIT_ERROR })
    expect(LAST_VISIT_ERROR.startsWith('読み取れませんでした')).toBe(true)
  })

  it('7月 → 2026-07-31（AC-11 のひいらぎ）', () => {
    expect(parseLastVisitInput('7月', T)).toEqual({ kind: 'date', date: '2026-07-31', approx: true })
  })
})
