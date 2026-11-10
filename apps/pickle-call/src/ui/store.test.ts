// 保存データの検査（store.tsx）: 壊れた進行中の試合は読み込まず、履歴は壊れた1件だけを除く。
import { describe, expect, it } from 'vitest'
import { isCurrent, isRecord } from './store'

const setup = {
  format: { kind: 'doubles', scoring: 'sideout', target: 11, winBy: 2 },
  names: { A1: 'あおい' },
  startingServer: { A: 'A1', B: 'B1' },
  firstServingTeam: 'A',
  rulesetId: 'usap-2026',
}
const setEvent = { type: 'set', at: 1, score: { A: 1, B: 1 }, servingTeam: 'A', server: 'A1', serverNumber: 1, startingServer: { A: 'A1', B: 'B1' } }
const current = (events: unknown[]) => ({ id: 'g1', setup, events, startedAt: 0, flipped: false })

const record = {
  id: 'r1',
  startedAt: 1,
  endedAt: 2,
  format: setup.format,
  names: { A1: 'あおい' },
  score: { A: 11, B: 3 },
  winner: 'A',
  rallies: 20,
  sideOuts: 5,
  rulesetId: 'usap-2026',
}

describe('isCurrent（進行中の試合）', () => {
  it('正しい形なら通す', () => {
    expect(isCurrent(current([{ type: 'rally', winner: 'A', at: 0 }, setEvent]))).toBe(true)
  })

  it('「直す」のイベントのスターティングサーバーが欠けていたら通さない（読み込むと計算で落ちるため）', () => {
    expect(isCurrent(current([{ ...setEvent, startingServer: {} }]))).toBe(false)
    expect(isCurrent(current([{ ...setEvent, startingServer: { A: 'A1' } }]))).toBe(false)
    expect(isCurrent(current([{ ...setEvent, startingServer: { A: 'A1', B: 'X9' } }]))).toBe(false)
  })
})

describe('isRecord（履歴の1件）', () => {
  it('正しい形なら通す（名前なしも可）', () => {
    expect(isRecord(record)).toBe(true)
    const { names: _names, ...noNames } = record
    expect(isRecord(noNames)).toBe(true)
  })

  it.each([
    ['startedAt がない', { startedAt: undefined }],
    ['format がない', { format: undefined }],
    ['format が壊れている', { format: { kind: 'x' } }],
    ['点数が数でない', { score: { A: {}, B: 3 } }],
    ['名前が文字でない', { names: { A1: { a: 1 } } }],
    ['勝者がいない', { winner: 'C' }],
    ['ラリー数がない', { rallies: 'many' }],
  ])('%s なら通さない', (_label, patch) => {
    expect(isRecord({ ...record, ...patch })).toBe(false)
  })

  it('壊れた1件があっても、ほかの記録は残せる（1件ずつ選り分ける）', () => {
    const list: unknown[] = [record, { ...record, id: 'bad', startedAt: undefined }, { ...record, id: 'r2' }]
    expect(list.filter(isRecord).map((r) => r.id)).toEqual(['r1', 'r2'])
  })
})
