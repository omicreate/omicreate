import { describe, expect, it } from 'vitest'
import { cycleFromGaps, personalCycle, personalCycleDays } from './cycle'
import { T, visit, visitsFromGaps } from '../test/factories'

describe('6.3 いつもの周期（personalCycleDays）', () => {
  const table: Array<[string, number[], number | null]> = [
    ['56, 56, 56', [56, 56, 56], 56],
    ['60, 60, 95', [60, 60, 95], 60],
    ['60, 70', [60, 70], 65],
    ['42, 49 → 45.5 を四捨五入', [42, 49], 46],
    ['5, 60（5 は除く）', [5, 60], 60],
    ['400, 60（400 は除く）', [400, 60], 60],
    ['6つ: 30, 40, 50, 60, 70, 80', [30, 40, 50, 60, 70, 80], 60],
  ]

  it.each(table)('%s', (_label, gaps, expected) => {
    // 来店記録から計算
    expect(personalCycleDays(visitsFromGaps('a', gaps, T), T)).toBe(expected)
    // 間隔の並びから計算
    expect(cycleFromGaps(gaps).days).toBe(expected)
  })

  it('来店1回だけ → null', () => {
    expect(personalCycleDays([visit('a', '2026-10-01')], T)).toBeNull()
  })

  it('年月だけの記録＋正確な記録1回 → null', () => {
    const vs = [visit('a', '2026-07-31', { dateApprox: 'month', source: 'bulk' }), visit('a', '2026-10-01')]
    expect(personalCycleDays(vs, T)).toBeNull()
  })

  it('同じ日の記録は1回として数え、削除印つき・未来の記録は除く', () => {
    const vs = [
      visit('a', '2026-08-01'),
      visit('a', '2026-08-01'),
      visit('a', '2026-09-26'),
      visit('a', '2026-10-10', { deletedAt: '2026-10-11T00:00:00Z' }),
      visit('a', '2026-12-01'),
    ]
    expect(personalCycle(vs, T)).toEqual({ days: 56, intervalsUsed: 1 })
  })

  it('使った間隔の数を返す（最大5）', () => {
    expect(personalCycle(visitsFromGaps('a', [56, 56, 56], T), T).intervalsUsed).toBe(3)
    expect(personalCycle(visitsFromGaps('a', [30, 40, 50, 60, 70, 80], T), T).intervalsUsed).toBe(5)
  })
})
