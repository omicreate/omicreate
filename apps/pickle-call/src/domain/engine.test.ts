// ゴールデンテスト: 仕様 §9 の期待値表と1文字も違わないこと。
// 表は USA Pickleball Official Rulebook 2026 の 4.A・5.A・5.B・6.B・14.A をもとに作ったもの。
import { describe, expect, it } from 'vitest'
import { applyEvent, initialState, replay } from './engine'
import type { Format, GameEvent, PlayerId, Setup, Team } from './types'
import { deriveView, viewFromEvents } from './view'

function setupOf(format: Partial<Format> = {}): Setup {
  return {
    format: { kind: 'doubles', scoring: 'sideout', target: 11, winBy: 2, ...format },
    names: {},
    startingServer: { A: 'A1', B: 'B1' },
    firstServingTeam: 'A',
    rulesetId: 'usap-2026',
  }
}

const ev = (seq: string): GameEvent[] =>
  seq
    .split(' ')
    .filter(Boolean)
    .map((w, i) => ({ type: 'rally', winner: w as Team, at: i }))

const sideJa = (s: 'right' | 'left') => (s === 'right' ? '右' : '左')

/** 各段の [コール, "サーバー(側)", レシーバー, A右, B右] */
function rows(setup: Setup, seq: string) {
  const events = ev(seq)
  const out: string[][] = []
  for (let i = 0; i <= events.length; i += 1) {
    const { view } = viewFromEvents(setup, events.slice(0, i))
    const rightOf = (t: Team) =>
      (Object.entries(view.positions) as [PlayerId, string][]).find(([p, s]) => p[0] === t && s === 'right')?.[0] ?? '-'
    out.push([view.callText, `${view.server}(${sideJa(view.serverSide)})`, view.receiver, rightOf('A'), rightOf('B')])
  }
  return out
}

describe('① ダブルス・サイドアウト方式（A A B B A A B B B A）', () => {
  const expected = [
    ['0-0-2', 'A1(右)', 'B1', 'A1', 'B1'],
    ['1-0-2', 'A1(左)', 'B2', 'A2', 'B1'],
    ['2-0-2', 'A1(右)', 'B1', 'A1', 'B1'],
    ['0-2-1', 'B1(右)', 'A1', 'A1', 'B1'],
    ['1-2-1', 'B1(左)', 'A2', 'A1', 'B2'],
    ['1-2-2', 'B2(右)', 'A1', 'A1', 'B2'],
    ['2-1-1', 'A1(右)', 'B2', 'A1', 'B2'],
    ['2-1-2', 'A2(左)', 'B1', 'A1', 'B2'],
    ['1-2-1', 'B2(右)', 'A1', 'A1', 'B2'],
    ['2-2-1', 'B2(左)', 'A2', 'A1', 'B1'],
    ['2-2-2', 'B1(右)', 'A1', 'A1', 'B1'],
  ]
  it('全段が期待値表と一致する', () => {
    expect(rows(setupOf(), 'A A B B A A B B B A')).toEqual(expected)
  })
})

describe('② シングルス・サイドアウト方式（A A A B B B A）', () => {
  it('コールとサーバーの側', () => {
    const setup = setupOf({ kind: 'singles' })
    const events = ev('A A A B B B A')
    const calls: string[] = []
    const servers: string[] = []
    for (let i = 0; i <= events.length; i += 1) {
      const { view } = viewFromEvents(setup, events.slice(0, i))
      calls.push(view.callText)
      servers.push(`${view.server}(${sideJa(view.serverSide)})`)
    }
    expect(calls).toEqual(['0-0', '1-0', '2-0', '3-0', '0-3', '1-3', '2-3', '3-2'])
    expect(servers).toEqual(['A1(右)', 'A1(左)', 'A1(右)', 'A1(左)', 'B1(右)', 'B1(左)', 'B1(右)', 'A1(左)'])
  })
})

describe('③ ダブルス・ラリー方式（A B B A A B）', () => {
  const expected = [
    ['0-0', 'A1(右)', 'B1', 'A1', 'B1'],
    ['1-0', 'A1(左)', 'B2', 'A2', 'B1'],
    ['1-1', 'B2(右)', 'A2', 'A2', 'B2'],
    ['2-1', 'B2(左)', 'A1', 'A2', 'B1'],
    ['2-2', 'A1(右)', 'B1', 'A1', 'B1'],
    ['3-2', 'A1(左)', 'B2', 'A2', 'B1'],
    ['3-3', 'B2(右)', 'A2', 'A2', 'B2'],
  ]
  it('全段が期待値表と一致する', () => {
    expect(rows(setupOf({ scoring: 'rally' }), 'A B B A A B')).toEqual(expected)
  })
})

describe('④ シングルス・ラリー方式（A B B A）', () => {
  it('コールとサーバーの側', () => {
    const setup = setupOf({ kind: 'singles', scoring: 'rally' })
    const events = ev('A B B A')
    const calls: string[] = []
    const servers: string[] = []
    for (let i = 0; i <= events.length; i += 1) {
      const { view } = viewFromEvents(setup, events.slice(0, i))
      calls.push(view.callText)
      servers.push(`${view.server}(${sideJa(view.serverSide)})`)
    }
    expect(calls).toEqual(['0-0', '1-0', '1-1', '2-1', '2-2'])
    expect(servers).toEqual(['A1(右)', 'A1(左)', 'B1(左)', 'B1(右)', 'A1(右)'])
  })
})

describe('⑤ 境界', () => {
  it('サイドアウト方式で A が11連勝すると 11-0 で A の勝ち', () => {
    const s = replay(setupOf(), ev(Array(11).fill('A').join(' ')))
    expect(s.score).toEqual({ A: 11, B: 0 })
    expect(s.winner).toBe('A')
  })

  it('10-10 → 11-10 は続行し、12-10 で終了（winBy=2）', () => {
    const setup = setupOf()
    let s = applyEvent(initialState(setup), { type: 'set', score: { A: 10, B: 10 }, servingTeam: 'A', serverNumber: 1, server: 'A1', startingServer: { A: 'A1', B: 'B1' }, at: 0 }, setup)
    s = applyEvent(s, { type: 'rally', winner: 'A', at: 1 }, setup)
    expect(s.score).toEqual({ A: 11, B: 10 })
    expect(s.winner).toBeNull()
    s = applyEvent(s, { type: 'rally', winner: 'A', at: 2 }, setup)
    expect(s.winner).toBe('A')
  })

  it('winBy=1 なら 11-10 で終了', () => {
    const setup = setupOf({ winBy: 1 })
    let s = applyEvent(initialState(setup), { type: 'set', score: { A: 10, B: 10 }, servingTeam: 'A', serverNumber: 1, server: 'A1', startingServer: { A: 'A1', B: 'B1' }, at: 0 }, setup)
    s = applyEvent(s, { type: 'rally', winner: 'A', at: 1 }, setup)
    expect(s.winner).toBe('A')
  })

  it('ラリー方式で A5-B10・A がサーブ中に B が勝つと、B11 で B の勝ち（2026改訂）', () => {
    const setup = setupOf({ scoring: 'rally' })
    const s = replay(setup, ev([...Array(10).fill('B'), ...Array(5).fill('A')].join(' ')))
    expect(s.score).toEqual({ A: 5, B: 10 })
    expect(s.servingTeam).toBe('A')
    const n = applyEvent(s, { type: 'rally', winner: 'B', at: 99 }, setup)
    expect(n.score.B).toBe(11)
    expect(n.winner).toBe('B')
  })

  it('サイドアウト方式で A がサーブ中、B が10点のときに B が勝ってもサイドアウトだけ', () => {
    const setup = setupOf()
    let s = applyEvent(initialState(setup), { type: 'set', score: { A: 3, B: 10 }, servingTeam: 'A', serverNumber: 2, server: 'A2', startingServer: { A: 'A1', B: 'B1' }, at: 0 }, setup)
    s = applyEvent(s, { type: 'rally', winner: 'B', at: 1 }, setup)
    expect(s.score).toEqual({ A: 3, B: 10 })
    expect(s.winner).toBeNull()
    expect(s.servingTeam).toBe('B')
  })

  it.each([
    [11, 6],
    [15, 8],
    [21, 11],
  ] as const)('%i点ゲームのエンドチェンジの目安は、初めて%i点になったラリーで1回だけ', (target, at) => {
    const setup = setupOf({ target })
    const events = ev(Array(target).fill('A').join(' '))
    let flags = 0
    let flaggedScore = -1
    for (let i = 1; i <= events.length; i += 1) {
      const prev = replay(setup, events.slice(0, i - 1))
      const next = replay(setup, events.slice(0, i))
      const v = deriveView(prev, next, setup, events[i - 1])
      if (v.endChangeNow) {
        flags += 1
        flaggedScore = next.score.A
      }
    }
    expect(flags).toBe(1)
    expect(flaggedScore).toBe(at)
  })

  it('勝者が決まった後のラリーは状態を変えない（同じ参照）', () => {
    const setup = setupOf()
    const s = replay(setup, ev(Array(11).fill('A').join(' ')))
    expect(applyEvent(s, { type: 'rally', winner: 'B', at: 0 }, setup)).toBe(s)
  })
})

describe('手で直す（set）', () => {
  it('指定した値がそのまま反映され、立ち位置は偶奇から導かれる', () => {
    const setup = setupOf()
    const s = applyEvent(initialState(setup), { type: 'set', score: { A: 5, B: 3 }, servingTeam: 'A', serverNumber: 2, server: 'A2', startingServer: { A: 'A1', B: 'B1' }, at: 0 }, setup)
    const v = deriveView(null, s, setup)
    expect(v.callText).toBe('5-3-2')
    // A は5点（奇数）なので A2 が右。B は3点（奇数）なので B2 が右
    expect(v.positions).toMatchObject({ A1: 'left', A2: 'right', B1: 'left', B2: 'right' })
    expect(v.serverSide).toBe('right')
    expect(v.receiver).toBe('B2')
  })

  it('サーブ側でない人をサーバーに指定したら、点数どおりに右の人にする', () => {
    const setup = setupOf()
    const s = applyEvent(initialState(setup), { type: 'set', score: { A: 2, B: 1 }, servingTeam: 'B', serverNumber: 1, server: 'A1', startingServer: { A: 'A1', B: 'B1' }, at: 0 }, setup)
    expect(s.server).toBe('B2')
  })

  it('勝ちの点数を入れると勝者を判定し直す', () => {
    const setup = setupOf()
    const s = applyEvent(initialState(setup), { type: 'set', score: { A: 11, B: 4 }, servingTeam: 'A', serverNumber: 1, server: 'A1', startingServer: { A: 'A1', B: 'B1' }, at: 0 }, setup)
    expect(s.winner).toBe('A')
  })

  it('点数は0〜99の整数に丸める', () => {
    const setup = setupOf()
    const s = applyEvent(initialState(setup), { type: 'set', score: { A: -3, B: 250.7 }, servingTeam: 'A', serverNumber: 1, server: 'A1', startingServer: { A: 'A1', B: 'B1' }, at: 0 }, setup)
    expect(s.score).toEqual({ A: 0, B: 99 })
  })
})

describe('説明キー', () => {
  it('①の流れで、開始・得点・サイドアウト（開始時）・2人目・サイドアウトが正しく出る', () => {
    const setup = setupOf()
    const events = ev('A A B B A A B')
    const keys = Array.from({ length: events.length + 1 }, (_, i) => viewFromEvents(setup, events.slice(0, i)).view.explain.key)
    expect(keys).toEqual(['start', 'point', 'point', 'side-out-start', 'point', 'second-server', 'side-out', 'second-server'])
  })
})
