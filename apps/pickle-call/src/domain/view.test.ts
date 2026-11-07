// 表示の導出（view.ts）: ゲームポイント・サイドアウト表示・説明キー・エンドチェンジの目安・レシーバー。
import { describe, expect, it } from 'vitest'
import { applyEvent, initialState, replay } from './engine'
import { RULESET } from './rules/usap-2026'
import type { ExplainKey, Format, GameEvent, GameState, PlayerId, Setup, Team } from './types'
import { callOf, deriveView, explainKeyOf, gamePointOf, playersOf, receiverOf, viewFromEvents } from './view'

function setupOf(format: Partial<Format> = {}, extra: Partial<Setup> = {}): Setup {
  return {
    format: { kind: 'doubles', scoring: 'sideout', target: 11, winBy: 2, ...format },
    names: {},
    startingServer: { A: 'A1', B: 'B1' },
    firstServingTeam: 'A',
    rulesetId: 'usap-2026',
    ...extra,
  }
}

const ev = (seq: string): GameEvent[] =>
  seq
    .split(' ')
    .filter(Boolean)
    .map((w, i) => ({ type: 'rally', winner: w as Team, at: i }))

function setEvent(score: Record<Team, number>, servingTeam: Team, serverNumber: 1 | 2 | null = 1, server?: PlayerId): GameEvent {
  return {
    type: 'set',
    score,
    servingTeam,
    serverNumber,
    server: server ?? (servingTeam === 'A' ? 'A1' : 'B1'),
    startingServer: { A: 'A1', B: 'B1' },
    at: 0,
  }
}

/** set で作った状態（直前の状態は初期状態） */
function stateAt(setup: Setup, score: Record<Team, number>, servingTeam: Team, serverNumber: 1 | 2 | null = 1): GameState {
  return applyEvent(initialState(setup), setEvent(score, servingTeam, serverNumber), setup)
}

const keysOf = (setup: Setup, seq: string) => {
  const events = ev(seq)
  return Array.from({ length: events.length + 1 }, (_, i) => viewFromEvents(setup, events.slice(0, i)).view.explain.key)
}

describe('gamePoint（次の1点で勝てるチーム）', () => {
  it('サイドアウト方式ではサーブ側だけ（4.A）', () => {
    const s = setupOf()
    expect(gamePointOf(stateAt(s, { A: 10, B: 9 }, 'A'), s)).toEqual(['A'])
    // A が10点でも、サーブ側が B なら A はこのラリーで勝てない。B も 10-10 にしかならない
    expect(gamePointOf(stateAt(s, { A: 10, B: 9 }, 'B'), s)).toEqual([])
    expect(gamePointOf(stateAt(s, { A: 3, B: 10 }, 'A'), s)).toEqual([])
    expect(gamePointOf(stateAt(s, { A: 3, B: 10 }, 'B'), s)).toEqual(['B'])
  })

  it('2点差が必要なら 10-10 はゲームポイントではない。winBy=1 ならサーブ側がゲームポイント', () => {
    expect(gamePointOf(stateAt(setupOf(), { A: 10, B: 10 }, 'A'), setupOf())).toEqual([])
    const s1 = setupOf({ winBy: 1 })
    expect(gamePointOf(stateAt(s1, { A: 10, B: 10 }, 'B'), s1)).toEqual(['B'])
  })

  it('ジュースが続いても、2点差になる1点ならゲームポイント', () => {
    const s = setupOf()
    expect(gamePointOf(stateAt(s, { A: 14, B: 13 }, 'A'), s)).toEqual(['A'])
    expect(gamePointOf(stateAt(s, { A: 14, B: 14 }, 'A'), s)).toEqual([])
  })

  it('15点・21点のゲームでも目標点で判定する', () => {
    const s15 = setupOf({ target: 15 })
    expect(gamePointOf(stateAt(s15, { A: 14, B: 12 }, 'A'), s15)).toEqual(['A'])
    expect(gamePointOf(stateAt(s15, { A: 10, B: 9 }, 'A'), s15)).toEqual([])
    const s21 = setupOf({ target: 21 })
    expect(gamePointOf(stateAt(s21, { A: 20, B: 20 }, 'A'), s21)).toEqual([])
    expect(gamePointOf(stateAt(s21, { A: 20, B: 19 }, 'A'), s21)).toEqual(['A'])
    expect(gamePointOf(stateAt(s21, { A: 19, B: 18 }, 'A'), s21)).toEqual([])
  })

  it('ラリー方式では両チームが対象（14.A.2・2026改訂）', () => {
    const s = setupOf({ scoring: 'rally' })
    expect(gamePointOf(stateAt(s, { A: 5, B: 10 }, 'A', null), s)).toEqual(['B'])
    expect(gamePointOf(stateAt(s, { A: 10, B: 9 }, 'B', null), s)).toEqual(['A'])
    expect(gamePointOf(stateAt(s, { A: 10, B: 10 }, 'A', null), s)).toEqual([])
    const s1 = setupOf({ scoring: 'rally', winBy: 1 })
    expect(gamePointOf(stateAt(s1, { A: 10, B: 10 }, 'A', null), s1)).toEqual(['A', 'B'])
  })

  it('シングルスも同じ（サイドアウト方式はサーブ側だけ）', () => {
    const s = setupOf({ kind: 'singles' })
    expect(gamePointOf(stateAt(s, { A: 10, B: 10 }, 'A', null), s)).toEqual([])
    expect(gamePointOf(stateAt(s, { A: 7, B: 10 }, 'A', null), s)).toEqual([])
    expect(gamePointOf(stateAt(s, { A: 7, B: 10 }, 'B', null), s)).toEqual(['B'])
  })

  it('ゲームが終わったら空', () => {
    const s = setupOf()
    const done = replay(s, ev(Array(11).fill('A').join(' ')))
    expect(done.winner).toBe('A')
    expect(gamePointOf(done, s)).toEqual([])
    expect(viewFromEvents(s, ev(Array(11).fill('A').join(' '))).view.gamePoint).toEqual([])
  })

  it('表示の gamePoint は、ラリーを重ねた状態から計算される', () => {
    const s = setupOf()
    const { view } = viewFromEvents(s, ev(Array(10).fill('A').join(' ')))
    expect(view.callText).toBe('10-0-2')
    expect(view.gamePoint).toEqual(['A'])
  })
})

describe('isSideOut（サーブ側が替わったか）', () => {
  const at = (setup: Setup, seq: string) => viewFromEvents(setup, ev(seq)).view.isSideOut

  it('開始時と得点では false、サイドアウトで true（ダブルス・サイドアウト方式）', () => {
    const s = setupOf()
    expect(at(s, '')).toBe(false)
    expect(at(s, 'A')).toBe(false)
    expect(at(s, 'A B')).toBe(true) // 0-0-2 のサーバーが負けてすぐサイドアウト
    expect(at(s, 'A B B')).toBe(false)
    expect(at(s, 'A B A')).toBe(false) // 1人目 → 2人目はサイドアウトではない
    expect(at(s, 'A B A A')).toBe(true)
  })

  it('シングルスとラリー方式でも、サーブ側が替わったときだけ true', () => {
    expect(at(setupOf({ kind: 'singles' }), 'A')).toBe(false)
    expect(at(setupOf({ kind: 'singles' }), 'A B')).toBe(true)
    expect(at(setupOf({ scoring: 'rally' }), 'A')).toBe(false)
    expect(at(setupOf({ scoring: 'rally' }), 'B')).toBe(true)
    expect(at(setupOf({ kind: 'singles', scoring: 'rally' }), 'B B')).toBe(false)
  })

  it('手で直した（set）ときは、サーブ側が替わっても false', () => {
    const s = setupOf()
    const events: GameEvent[] = [setEvent({ A: 2, B: 3 }, 'B', 1)]
    const { view } = viewFromEvents(s, events)
    expect(view.servingTeam).toBe('B')
    expect(view.isSideOut).toBe(false)
  })

  it('勝者が決まった後の（無視された）ラリーでは false', () => {
    const s = setupOf()
    const { view } = viewFromEvents(s, ev(`${Array(11).fill('A').join(' ')} B`))
    expect(view.isSideOut).toBe(false)
    expect(view.endChangeNow).toBe(false)
    expect(view.explain.key).toBe('game')
  })
})

describe('説明キー（なぜこのスコア？）', () => {
  it('開始のキーは形式ごとに違う', () => {
    expect(keysOf(setupOf(), '')).toEqual(['start'])
    expect(keysOf(setupOf({ scoring: 'rally' }), '')).toEqual(['start-rally'])
    expect(keysOf(setupOf({ kind: 'singles' }), '')).toEqual(['start-singles'])
    expect(keysOf(setupOf({ kind: 'singles', scoring: 'rally' }), '')).toEqual(['start-singles'])
  })

  it('シングルス・サイドアウト方式: 得点と、サイドアウト', () => {
    expect(keysOf(setupOf({ kind: 'singles' }), 'A A B A B')).toEqual([
      'start-singles',
      'point-singles',
      'point-singles',
      'side-out-singles',
      'side-out-singles',
      'side-out-singles',
    ])
  })

  it('ダブルス・ラリー方式: 得点と、レシーブ側の得点（サイドアウト）', () => {
    expect(keysOf(setupOf({ scoring: 'rally' }), 'A B B A')).toEqual(['start-rally', 'rally-point', 'rally-side-out', 'rally-point', 'rally-side-out'])
  })

  it('シングルス・ラリー方式: シングルス用のキー', () => {
    expect(keysOf(setupOf({ kind: 'singles', scoring: 'rally' }), 'A B B A')).toEqual([
      'start-singles',
      'rally-point-singles',
      'rally-side-out-singles',
      'rally-point-singles',
      'rally-side-out-singles',
    ])
  })

  it('B が先にサーブしても、最初のサイドアウトは side-out-start、次からは side-out', () => {
    const s = setupOf({}, { firstServingTeam: 'B' })
    expect(keysOf(s, 'A A B B')).toEqual(['start', 'side-out-start', 'point', 'second-server', 'side-out'])
  })

  it('最初のサイドアウトより前にスコアを手で直したら、その後のサイドアウトは side-out（開始直後の説明は出さない）', () => {
    const s = setupOf()
    const events: GameEvent[] = [setEvent({ A: 5, B: 3 }, 'A', 2, 'A2'), ...ev('B')]
    const v = viewFromEvents(s, events).view
    expect(v.isSideOut).toBe(true)
    expect(v.explain.key).toBe('side-out')
    expect(v.explain.refs).toEqual(RULESET.explainRefs['side-out'])
    // 直していなければ、従来どおり side-out-start
    expect(viewFromEvents(s, ev('A B')).view.explain.key).toBe('side-out-start')
  })

  it('勝った1点は game。勝者が決まった後のラリーも game（viewFromEvents は prev を別に作り直すので、参照の一致に頼らない）', () => {
    const s = setupOf()
    const keys = keysOf(s, `${Array(11).fill('A').join(' ')} B`)
    expect(keys.slice(-3)).toEqual(['point', 'game', 'game'])
    const r = setupOf({ scoring: 'rally' })
    // ラリー方式でレシーブ側が決勝点を取っても game（rally-side-out にはしない）
    const rk = keysOf(r, `${Array(10).fill('B').join(' ')} ${Array(5).fill('A').join(' ')} B`)
    expect(rk[rk.length - 1]).toBe('game')
  })

  it('手で直したら manual（条番号なし）', () => {
    const s = setupOf()
    const { view } = viewFromEvents(s, [...ev('A A'), setEvent({ A: 5, B: 3 }, 'A', 2, 'A2')])
    expect(view.explain).toEqual({ key: 'manual', refs: [] })
  })

  it('explainKeyOf は前の状態がなければ開始のキー', () => {
    const s = setupOf({ scoring: 'rally' })
    const st = initialState(s)
    expect(explainKeyOf(null, st, s)).toBe('start-rally')
    expect(explainKeyOf(st, st, s)).toBe('start-rally') // lastEvent がないときも開始扱い
  })

  it('説明の条番号は RULESET.explainRefs から引く', () => {
    const keys: ExplainKey[] = []
    const cases: [Setup, string][] = [
      [setupOf(), 'A A B B A A B'],
      [setupOf({ kind: 'singles' }), 'A B'],
      [setupOf({ scoring: 'rally' }), 'A B'],
      [setupOf({ kind: 'singles', scoring: 'rally' }), 'A B'],
    ]
    for (const [s, seq] of cases) {
      const events = ev(seq)
      for (let i = 0; i <= events.length; i += 1) {
        const { view } = viewFromEvents(s, events.slice(0, i))
        expect(view.explain.refs).toEqual(RULESET.explainRefs[view.explain.key])
        keys.push(view.explain.key)
      }
    }
    expect(new Set(keys).size).toBeGreaterThanOrEqual(12)
  })
})

describe('エンドチェンジの目安（endChangeNow）', () => {
  const formats: Partial<Format>[] = [
    {},
    { kind: 'singles' },
    { scoring: 'rally' },
    { kind: 'singles', scoring: 'rally' },
  ]
  const targets = [11, 15, 21] as const

  for (const f of formats) {
    for (const target of targets) {
      it(`${f.kind ?? 'doubles'}・${f.scoring ?? 'sideout'}・${target}点: 初めて${RULESET.endChange[target]}点になったラリーで1回だけ`, () => {
        const s = setupOf({ ...f, target })
        const threshold = RULESET.endChange[target]
        // B が先に少し取ってから A が追いつく混ぜた流れ。どちらが先に閾値へ届いても1回だけ
        const events = ev(`${'B '.repeat(3)}${'A '.repeat(target)}`)
        const flags: number[] = []
        for (let i = 1; i <= events.length; i += 1) {
          const { state, view } = viewFromEvents(s, events.slice(0, i))
          if (view.endChangeNow) {
            flags.push(i)
            expect(Math.max(state.score.A, state.score.B)).toBe(threshold)
          }
        }
        expect(flags).toHaveLength(1)
      })
    }
  }

  it('B が先に閾値に届いても立つ（ラリー方式）', () => {
    const s = setupOf({ scoring: 'rally' })
    const { view, state } = viewFromEvents(s, ev('A B B B B B B'))
    expect(state.score).toEqual({ A: 1, B: 6 })
    expect(view.endChangeNow).toBe(true)
  })

  it('次のラリーでは消え、1手戻すと（同じ場面を作り直すので）また出る', () => {
    const s = setupOf()
    const six = ev('A A A A A A')
    expect(viewFromEvents(s, six).view.endChangeNow).toBe(true)
    expect(viewFromEvents(s, [...six, ...ev('A')]).view.endChangeNow).toBe(false)
    expect(viewFromEvents(s, six.slice(0, 5)).view.endChangeNow).toBe(false)
  })

  it('手で直して閾値を越えたときは知らせず、その後のラリーでも立てない', () => {
    const s = setupOf()
    const events: GameEvent[] = [setEvent({ A: 7, B: 2 }, 'A', 1)]
    const a = viewFromEvents(s, events)
    expect(a.view.endChangeNow).toBe(false)
    expect(a.state.endChangeAt).not.toBeNull()
    const b = viewFromEvents(s, [...events, ...ev('A')])
    expect(b.view.endChangeNow).toBe(false)
  })
})

describe('レシーバー・コール・選手', () => {
  it('playersOf: ダブルスは4人、シングルスは2人', () => {
    expect(playersOf(setupOf())).toEqual(['A1', 'A2', 'B1', 'B2'])
    expect(playersOf(setupOf({ kind: 'singles' }))).toEqual(['A1', 'B1'])
  })

  it('receiverOf: ダブルスはサーバーと同じ側のレシーブ側の人。シングルスは相手', () => {
    const s = setupOf()
    const st = stateAt(s, { A: 3, B: 2 }, 'A')
    // B は2点（偶数）なので B1 が右・B2 が左
    expect(receiverOf(st, s, 'right')).toBe('B1')
    expect(receiverOf(st, s, 'left')).toBe('B2')
    const st2 = stateAt(s, { A: 3, B: 2 }, 'B')
    // A は3点（奇数）なので A2 が右・A1 が左
    expect(receiverOf(st2, s, 'right')).toBe('A2')
    expect(receiverOf(st2, s, 'left')).toBe('A1')
    const sg = setupOf({ kind: 'singles' })
    expect(receiverOf(stateAt(sg, { A: 1, B: 0 }, 'A', null), sg, 'left')).toBe('B1')
    expect(receiverOf(stateAt(sg, { A: 1, B: 0 }, 'B', null), sg, 'right')).toBe('A1')
  })

  it('スターティングサーバーを A2・B2 にすると、開始時は A2 がサーブし B2 がレシーブ', () => {
    const s = setupOf({}, { startingServer: { A: 'A2', B: 'B2' } })
    const { view } = viewFromEvents(s, [])
    expect(view.server).toBe('A2')
    expect(view.serverSide).toBe('right')
    expect(view.receiver).toBe('B2')
    expect(view.positions).toEqual({ A1: 'left', A2: 'right', B1: 'left', B2: 'right' })
  })

  it('callOf: サーブ側 → レシーブ側（→ サーバー番号）', () => {
    const s = setupOf()
    expect(callOf(stateAt(s, { A: 4, B: 2 }, 'A', 1), s)).toEqual([4, 2, 1])
    expect(callOf(stateAt(s, { A: 4, B: 2 }, 'B', 2), s)).toEqual([2, 4, 2])
    const r = setupOf({ scoring: 'rally' })
    expect(callOf(stateAt(r, { A: 4, B: 2 }, 'B', null), r)).toEqual([2, 4])
  })

  it('deriveView は開始時（prev なし）に開始の表示を返す', () => {
    const s = setupOf()
    const v = deriveView(null, initialState(s), s)
    expect(v).toMatchObject({
      callText: '0-0-2',
      server: 'A1',
      serverSide: 'right',
      receiver: 'B1',
      servingTeam: 'A',
      serverNumber: 2,
      gamePoint: [],
      endChangeNow: false,
      isSideOut: false,
      explain: { key: 'start', refs: RULESET.explainRefs.start },
    })
  })

  it('viewFromEvents: イベントがなければ prev は null', () => {
    const s = setupOf()
    const r = viewFromEvents(s, [])
    expect(r.prev).toBeNull()
    expect(r.state).toEqual(initialState(s))
  })
})
