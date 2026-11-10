// 性質テスト（仕様 §17-2）。4つの形式 × 目標点 11/15/21 × winBy 1/2 × スターティングサーバー × 最初のサーブ側で、
// ランダムな A/B の列（最長300）を流し、どの時点でも規則（USA Pickleball 2026 の 4.A・4.B・5.A・5.B・6.B・14.A）が守られることを確かめる。
// 1回あたり最長300手 × 300回 × 性質の数になるので、ループの中では expect を使わず、軽い check で落とす。
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { applyEvent, initialState, isEven, isOver, nextGameSetup, other, partner, replay, singlesPlayer, teamOf, winnerOf } from './engine'
import { RULESET } from './rules/usap-2026'
import type { ExplainKey, Format, GameEvent, GameState, Kind, PlayerId, Scoring, Setup, Team, View } from './types'
import { deriveView, gamePointOf, viewFromEvents } from './view'

const NUM_RUNS = 300
const TEAMS = ['A', 'B'] as const

// ---- 入力の作り方 ----

const formatArb: fc.Arbitrary<Format> = fc.record({
  kind: fc.constantFrom<Kind>('doubles', 'singles'),
  scoring: fc.constantFrom<Scoring>('sideout', 'rally'),
  target: fc.constantFrom<Format['target']>(11, 15, 21),
  winBy: fc.constantFrom<Format['winBy']>(1, 2),
})

const setupArb: fc.Arbitrary<Setup> = fc
  .record({
    format: formatArb,
    a: fc.constantFrom<PlayerId>('A1', 'A2'),
    b: fc.constantFrom<PlayerId>('B1', 'B2'),
    first: fc.constantFrom<Team>('A', 'B'),
  })
  .map(({ format, a, b, first }) => ({
    format,
    names: {},
    startingServer: { A: a, B: b },
    firstServingTeam: first,
    rulesetId: 'usap-2026' as const,
  }))

const teamArb = fc.constantFrom<Team>('A', 'B')
/** 偏りのある列（片方が強い試合）。勝者が決まる場面を多く作る */
const biasedSeqArb = fc
  .tuple(fc.integer({ min: 1, max: 9 }), fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 30, maxLength: 300 }))
  .map(([p, xs]) => xs.map((x): Team => (x < p ? 'A' : 'B')))
const seqArb: fc.Arbitrary<Team[]> = fc.oneof(fc.array(teamArb, { maxLength: 300 }), biasedSeqArb)

const rallies = (seq: readonly Team[]): GameEvent[] => seq.map((winner, i) => ({ type: 'rally', winner, at: i }))

// ---- 走らせ方 ----

interface Walk {
  setup: Setup
  events: GameEvent[]
  /** states[i] は i 手目まで適用した状態（states[0] は初期状態） */
  states: GameState[]
  /** views[i] は states[i] の表示（直前の状態つき） */
  views: View[]
}

function walk(setup: Setup, events: GameEvent[]): Walk {
  const states: GameState[] = [initialState(setup)]
  const views: View[] = [deriveView(null, states[0], setup)]
  for (let i = 0; i < events.length; i += 1) {
    const next = applyEvent(states[i], events[i], setup)
    states.push(next)
    views.push(deriveView(states[i], next, setup, events[i]))
  }
  return { setup, events, states, views }
}

function check(cond: boolean, msg: string, ctx?: unknown): void {
  if (!cond) throw new Error(ctx === undefined ? msg : `${msg}\n${JSON.stringify(ctx)}`)
}

/** 規則から独立に書いた「勝ち」の定義（4.B・15.C） */
function expectedWinner(score: Record<Team, number>, f: Format): Team | null {
  for (const t of TEAMS) {
    const o = other(t)
    if (score[t] >= f.target && score[t] - score[o] >= f.winBy) return t
  }
  return null
}

const total = (s: GameState) => s.score.A + s.score.B
const isDoubles = (setup: Setup) => setup.format.kind === 'doubles'
const isDoublesSideout = (setup: Setup) => isDoubles(setup) && setup.format.scoring === 'sideout'

/** 各ステップ（1手ごと）を検査する性質 */
function forEachStep(
  name: string,
  fn: (w: Walk, i: number, prev: GameState, next: GameState, view: View, prevView: View) => void,
  setupFilter: (s: Setup) => boolean = () => true,
) {
  it(name, () => {
    fc.assert(
      fc.property(setupArb, seqArb, (setup, seq) => {
        if (!setupFilter(setup)) return
        const w = walk(setup, rallies(seq))
        for (let i = 1; i < w.states.length; i += 1) fn(w, i, w.states[i - 1], w.states[i], w.views[i], w.views[i - 1])
      }),
      { numRuns: NUM_RUNS },
    )
  })
}

/** すべての状態（初期状態を含む）を検査する性質 */
function forEachState(name: string, fn: (w: Walk, s: GameState, v: View, i: number) => void) {
  it(name, () => {
    fc.assert(
      fc.property(setupArb, seqArb, (setup, seq) => {
        const w = walk(setup, rallies(seq))
        w.states.forEach((s, i) => fn(w, s, w.views[i], i))
      }),
      { numRuns: NUM_RUNS },
    )
  })
}

describe('性質: サーバー番号とコール', () => {
  forEachState('serverNumber はダブルスのサイドアウト方式だけ 1 か 2、それ以外は null', (w, s, v) => {
    if (isDoublesSideout(w.setup)) check(s.serverNumber === 1 || s.serverNumber === 2, 'serverNumber must be 1|2', s)
    else check(s.serverNumber === null, 'serverNumber must be null', s)
    check(v.serverNumber === s.serverNumber, 'view.serverNumber mirrors state')
  })

  forEachState('コールの長さはダブルスのサイドアウト方式で3、それ以外で2。並びはサーブ側→レシーブ側（→番号）', (w, s, v) => {
    const len = isDoublesSideout(w.setup) ? 3 : 2
    check(v.call.length === len, `call length must be ${len}`, v.call)
    check(v.call[0] === s.score[s.servingTeam], 'call[0] is the serving team score', { s, call: v.call })
    check(v.call[1] === s.score[other(s.servingTeam)], 'call[1] is the receiving team score', { s, call: v.call })
    if (len === 3) check(v.call[2] === s.serverNumber, 'call[2] is the server number', { s, call: v.call })
    check(v.callText === v.call.join('-'), 'callText joins with "-"', v)
  })
})

describe('性質: 立ち位置（5.A.1・5.B.3）', () => {
  forEachState('ダブルス: 両チームとも、スターティングサーバーは自チームの点が偶数のとき、かつそのときだけ右', (w, s, v) => {
    if (!isDoubles(w.setup)) return
    for (const t of TEAMS) {
      const starter = s.startingServer[t]
      check(starter === w.setup.startingServer[t], 'starting server never changes without set', s)
      const right = v.positions[starter] === 'right'
      check(right === isEven(s.score[t]), `starting server of ${t} is right iff score even`, { s, positions: v.positions })
      check(v.positions[partner(starter)] !== v.positions[starter], 'partner stands on the other side', v.positions)
    }
  })

  forEachState('シングルス: サーバーの側はサーバーの点の偶奇と一致し、2人とも同じ側に立つ', (w, s, v) => {
    if (isDoubles(w.setup)) return
    check(s.server === singlesPlayer(s.servingTeam), 'singles server is the serving team player', s)
    const expected = isEven(s.score[s.servingTeam]) ? 'right' : 'left'
    check(v.serverSide === expected, 'server side follows server score parity', { s, v })
    check(v.positions.A1 === expected && v.positions.B1 === expected, 'both singles players on that side', v.positions)
    check(Object.keys(v.positions).length === 2, 'singles has two players', v.positions)
  })

  forEachState('レシーバーはサーバーと同じ側（対角）で、レシーブ側の選手。サーバーはサーブ側の選手', (_w, s, v) => {
    check(teamOf(v.server) === s.servingTeam, 'server belongs to the serving team', s)
    check(teamOf(v.receiver) === other(s.servingTeam), 'receiver belongs to the receiving team', v)
    check(v.positions[v.receiver] === v.serverSide, 'receiver side equals server side', v)
    check(v.positions[v.server] === v.serverSide, 'serverSide is the server position', v)
    check(v.server === s.server && v.servingTeam === s.servingTeam, 'view mirrors state', { s, v })
  })

  forEachStep(
    'サイドアウトの直後、サーバーは右にいる（ダブルスのサイドアウト方式・ラリー方式）',
    (w, _i, prev, next, view) => {
      if (prev.servingTeam === next.servingTeam) return
      check(view.serverSide === 'right', 'server on the right after side out', { prev, next })
      if (w.setup.format.scoring === 'sideout') check(next.serverNumber === 1, 'first server after side out', next)
    },
    isDoubles,
  )

  forEachStep(
    'サーブ側が得点しても、レシーブ側の位置は変わらない（ダブルス）',
    (_w, _i, prev, next, view, prevView) => {
      if (prev === next || prev.servingTeam !== next.servingTeam) return
      if (total(next) === total(prev)) return
      const rt = other(next.servingTeam)
      for (const p of [`${rt}1`, `${rt}2`] as PlayerId[]) {
        check(view.positions[p] === prevView.positions[p], 'receivers keep their positions', { prev, next })
      }
      // 同じサーバーが左右を替えて続ける（5.B.5・14.A.4）
      check(next.server === prev.server, 'same server keeps serving', { prev, next })
      check(view.serverSide !== prevView.serverSide, 'server switches sides after scoring', { prev, next })
    },
    isDoubles,
  )

  forEachStep(
    '点が動かないラリー（2人目への交代・サイドアウト）では、だれも動かない（ダブルスのサイドアウト方式）',
    (_w, _i, prev, next, view, prevView) => {
      if (prev === next || total(prev) !== total(next)) return
      check(JSON.stringify(view.positions) === JSON.stringify(prevView.positions), 'positions unchanged', { prev, next })
    },
    isDoublesSideout,
  )

  forEachStep(
    '1人目が負けるとパートナーが2人目として、いまの位置からサーブ（5.B.5）',
    (_w, _i, prev, next, view, prevView) => {
      if (prev === next || prev.serverNumber !== 1 || next.servingTeam !== prev.servingTeam || total(next) !== total(prev)) return
      check(next.serverNumber === 2, 'becomes second server', next)
      check(next.server === partner(prev.server), 'partner serves', { prev, next })
      check(view.serverSide === prevView.positions[next.server], 'serves from where the partner stands', { prev, next })
      check(view.explain.key === 'second-server', 'explain key second-server', view.explain)
    },
    isDoublesSideout,
  )
})

describe('性質: 得点（4.A・14.A.2）', () => {
  forEachStep('点数は減らず、1ラリーで動くのは勝った側の1点だけ（set を除く）', (w, i, prev, next) => {
    for (const t of TEAMS) check(next.score[t] >= prev.score[t], 'score never decreases', { prev, next })
    const d = total(next) - total(prev)
    check(d === 0 || d === 1, 'at most one point per rally', { prev, next })
    if (d === 1) {
      const ev = w.events[i - 1] as Extract<GameEvent, { type: 'rally' }>
      check(next.score[ev.winner] === prev.score[ev.winner] + 1, 'only the rally winner scores', { prev, next, ev })
    }
  })

  it('サイドアウト方式では総得点がサーブ側の勝ち数、ラリー方式ではラリー数と等しい（勝者が決まるまで）', () => {
    fc.assert(
      fc.property(setupArb, seqArb, (setup, seq) => {
        let s = initialState(setup)
        let servingWins = 0
        let played = 0
        let sideOuts = 0
        for (const e of rallies(seq)) {
          if (s.winner) break
          const prev = s
          s = applyEvent(s, e, setup)
          played += 1
          if (e.type === 'rally' && e.winner === prev.servingTeam) servingWins += 1
          if (prev.servingTeam !== s.servingTeam) sideOuts += 1
          if (setup.format.scoring === 'sideout') check(total(s) === servingWins, 'total == serving-team wins', { s, servingWins })
          else check(total(s) === played, 'total == rallies', { s, played })
          check(s.rallies === played, 'rallies counter', { s, played })
          check(s.sideOuts === sideOuts, 'sideOuts counter', { s, sideOuts })
        }
      }),
      { numRuns: NUM_RUNS },
    )
  })

  forEachStep('サイドアウト方式でサーブ側が勝つと、同じチーム・同じサーバーのまま1点', (w, i, prev, next) => {
    if (prev === next) return
    const ev = w.events[i - 1] as Extract<GameEvent, { type: 'rally' }>
    if (ev.winner !== prev.servingTeam) {
      check(total(next) === total(prev), 'receiving team never scores in side-out scoring', { prev, next })
      return
    }
    check(next.servingTeam === prev.servingTeam && next.server === prev.server, 'serve is kept', { prev, next })
    check(next.serverNumber === prev.serverNumber, 'server number kept', { prev, next })
  }, (s) => s.format.scoring === 'sideout')

  forEachStep('ラリー方式では、勝った側がいつも次のサーブ側（14.A.4）', (w, i, prev, next) => {
    if (prev === next) return
    const ev = w.events[i - 1] as Extract<GameEvent, { type: 'rally' }>
    check(next.servingTeam === ev.winner, 'rally winner serves next', { prev, next, ev })
    if (ev.winner === prev.servingTeam) check(next.server === prev.server, 'same server keeps serving', { prev, next })
  }, (s) => s.format.scoring === 'rally')
})

describe('性質: 勝ち（4.B・15.C）', () => {
  forEachState('勝者は「目標点以上かつ差が winBy 以上」のとき、かつそのときだけ決まる', (w, s) => {
    const exp = expectedWinner(s.score, w.setup.format)
    check(s.winner === exp, 'winner iff target reached with margin', { s, format: w.setup.format })
    check(winnerOf(s.score, w.setup) === exp, 'winnerOf agrees', s)
  })

  forEachStep('勝者は一度決まったら変わらない。サイドアウト方式では必ず最後のラリーのサーブ側、ラリー方式では最後のラリーの勝者', (w, i, prev, next) => {
    if (prev.winner) {
      check(next === prev, 'state frozen after winner', { prev, next })
      return
    }
    if (!next.winner) return
    const ev = w.events[i - 1] as Extract<GameEvent, { type: 'rally' }>
    check(next.winner === ev.winner, 'the last rally winner wins the game', { prev, next })
    if (w.setup.format.scoring === 'sideout') check(next.winner === prev.servingTeam, 'side-out scoring: only the serving team can win', { prev, next })
    check(next.servingTeam === next.winner, 'winner is serving at the end', next)
  })

  it('勝者が決まった後のラリーは状態を変えない（同じ参照を返す）', () => {
    fc.assert(
      fc.property(setupArb, seqArb, fc.array(teamArb, { minLength: 1, maxLength: 20 }), (setup, seq, extra) => {
        const events = rallies(seq)
        const s = replay(setup, events)
        if (!s.winner) return
        for (const t of TEAMS) check(applyEvent(s, { type: 'rally', winner: t, at: 0 }, setup) === s, 'same reference after winner')
        const all = [...events, ...rallies(extra)]
        const after = replay(setup, all)
        check(JSON.stringify(after) === JSON.stringify(s), 'extra rallies after the winner change nothing', { s, after })
        // 画面は viewFromEvents（prev と next を別々に作り直す）で作るので、そこでも「ゲーム終了」のまま
        const { view } = viewFromEvents(setup, all)
        check(view.explain.key === 'game', 'explain key stays game after the winner', view.explain)
        check(!view.isSideOut && !view.endChangeNow && view.gamePoint.length === 0, 'no side out / end change / game point after the winner', view)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  forEachState('ゲームポイント: 次のラリーに t が勝てば t の勝ちになる、のとき、かつそのときだけ t が gamePoint に入る', (w, s, v) => {
    check(JSON.stringify(v.gamePoint) === JSON.stringify(gamePointOf(s, w.setup)), 'view.gamePoint == gamePointOf')
    if (s.winner) {
      check(v.gamePoint.length === 0, 'no game point after the game', v)
      return
    }
    for (const t of TEAMS) {
      const wins = applyEvent(s, { type: 'rally', winner: t, at: 0 }, w.setup).winner === t
      check(v.gamePoint.includes(t) === wins, `gamePoint(${t}) iff the next rally by ${t} wins`, { s, gp: v.gamePoint })
    }
    if (w.setup.format.scoring === 'sideout') check(v.gamePoint.every((t) => t === s.servingTeam), 'side-out: only the serving team', v)
  })
})

describe('性質: 取り消し・決定性', () => {
  it('replay(events.slice(0,-1)) は最後のイベントを適用する前の状態と一致する（任意の位置で切っても同じ）', () => {
    fc.assert(
      fc.property(setupArb, fc.array(teamArb, { minLength: 1, maxLength: 300 }), fc.nat(), (setup, seq, cutSeed) => {
        const w = walk(setup, rallies(seq))
        const n = w.events.length
        const undone = replay(setup, w.events.slice(0, -1))
        check(JSON.stringify(undone) === JSON.stringify(w.states[n - 1]), 'undo equals the state before the last event')
        const fromEvents = viewFromEvents(setup, w.events)
        check(JSON.stringify(fromEvents.prev) === JSON.stringify(w.states[n - 1]), 'viewFromEvents.prev is the previous state')
        check(JSON.stringify(fromEvents.state) === JSON.stringify(w.states[n]), 'viewFromEvents.state is the current state')
        check(JSON.stringify(fromEvents.view) === JSON.stringify(w.views[n]), 'viewFromEvents.view is the current view')
        const k = cutSeed % (n + 1)
        check(JSON.stringify(replay(setup, w.events.slice(0, k))) === JSON.stringify(w.states[k]), `prefix ${k} replays to states[${k}]`)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('同じ入力なら同じ出力（決定性）。入力の setup と events は書き換えない', () => {
    fc.assert(
      fc.property(setupArb, seqArb, (setup, seq) => {
        const events = rallies(seq)
        const frozenSetup = deepFreeze(structuredClone(setup))
        const frozenEvents = deepFreeze(structuredClone(events))
        const a = viewFromEvents(frozenSetup, frozenEvents)
        const b = viewFromEvents(structuredClone(setup), structuredClone(events))
        check(JSON.stringify(a) === JSON.stringify(b), 'same input, same output')
        check(JSON.stringify(frozenSetup) === JSON.stringify(setup), 'setup untouched')
        check(JSON.stringify(frozenEvents) === JSON.stringify(events), 'events untouched')
      }),
      { numRuns: NUM_RUNS },
    )
  })
})

describe('性質: 説明キー・サイドアウト表示・エンドチェンジ', () => {
  const FAMILY: Record<string, ExplainKey[]> = {
    'doubles-sideout': ['point', 'second-server', 'side-out', 'side-out-start', 'game'],
    'singles-sideout': ['point-singles', 'side-out-singles', 'game'],
    'doubles-rally': ['rally-point', 'rally-side-out', 'game'],
    'singles-rally': ['rally-point-singles', 'rally-side-out-singles', 'game'],
  }
  const SIDE_OUT_KEYS: ExplainKey[] = ['side-out', 'side-out-start', 'side-out-singles', 'rally-side-out', 'rally-side-out-singles']

  forEachStep('説明キーは形式に合うものだけ。条番号は RULESET.explainRefs と同じ。isSideOut はサーブ側が替わったときだけ', (w, _i, prev, next, view) => {
    const fam = FAMILY[`${w.setup.format.kind}-${w.setup.format.scoring}`]
    const key = view.explain.key
    check(fam.includes(key), `key ${key} fits the format`, { format: w.setup.format })
    check(JSON.stringify(view.explain.refs) === JSON.stringify(RULESET.explainRefs[key]), 'refs from RULESET', view.explain)
    check(view.isSideOut === (prev.servingTeam !== next.servingTeam), 'isSideOut iff serving team changed', { prev, next })
    if (key !== 'game') check(SIDE_OUT_KEYS.includes(key) === view.isSideOut, 'side-out keys iff side out', { key, prev, next })
    if (key === 'side-out-start') check(prev.sideOuts === 0, 'side-out-start only for the first side out', prev)
  })

  it('エンドチェンジの目安は1ゲームに1回だけ、どちらかの点が初めて閾値に達したラリーで立つ（21.B.1〜21.B.3）', () => {
    fc.assert(
      fc.property(setupArb, seqArb, (setup, seq) => {
        const w = walk(setup, rallies(seq))
        const threshold = RULESET.endChange[setup.format.target]
        const firstReach = w.states.findIndex((s) => Math.max(s.score.A, s.score.B) >= threshold)
        const flagged = w.views.map((v, i) => (v.endChangeNow ? i : -1)).filter((i) => i >= 0)
        if (firstReach === -1) {
          check(flagged.length === 0, 'no end change before the threshold', flagged)
          check(w.states.every((s) => s.endChangeAt === null), 'endChangeAt stays null')
          return
        }
        check(JSON.stringify(flagged) === JSON.stringify([firstReach]), 'flag exactly once, at the first reach', { flagged, firstReach })
        w.states.forEach((s, i) => check(s.endChangeAt === (i < firstReach ? null : firstReach), 'endChangeAt set once and kept', { i, s }))
      }),
      { numRuns: NUM_RUNS },
    )
  })
})

describe('性質: 手で直す（set）を混ぜても、立ち位置と対角は崩れない', () => {
  const scoreArb = fc.oneof({ weight: 8, arbitrary: fc.integer({ min: -5, max: 120 }) }, { weight: 1, arbitrary: fc.constantFrom(NaN, Infinity, -Infinity, 2.5) })
  const playerArb = fc.constantFrom<PlayerId>('A1', 'A2', 'B1', 'B2')
  const setArb: fc.Arbitrary<GameEvent> = fc.record({
    type: fc.constant('set' as const),
    score: fc.record({ A: scoreArb, B: scoreArb }),
    servingTeam: teamArb,
    serverNumber: fc.constantFrom<1 | 2 | null>(1, 2, null),
    server: playerArb,
    startingServer: fc.record({ A: playerArb, B: playerArb }),
    at: fc.constant(0),
  })
  const rallyArb: fc.Arbitrary<GameEvent> = teamArb.map((winner) => ({ type: 'rally' as const, winner, at: 0 }))
  const mixedArb = fc.array(fc.oneof({ weight: 9, arbitrary: rallyArb }, { weight: 1, arbitrary: setArb }), { maxLength: 200 })

  it('set の直後: 点は0〜99の整数、サーブ側とサーバーが一致、勝者を判定し直す。その後もすべての不変条件が成り立つ', () => {
    fc.assert(
      fc.property(setupArb, mixedArb, (setup, events) => {
        const w = walk(setup, events)
        for (let i = 0; i < w.states.length; i += 1) {
          const s = w.states[i]
          const v = w.views[i]
          const e = i > 0 ? w.events[i - 1] : undefined
          if (e?.type === 'set') {
            for (const t of TEAMS) {
              check(Number.isInteger(s.score[t]) && s.score[t] >= 0 && s.score[t] <= 99, 'score clamped to 0..99', { e, s })
            }
            check(s.servingTeam === e.servingTeam, 'serving team applied', { e, s })
            if (isDoubles(setup) && teamOf(e.server) === e.servingTeam) check(s.server === e.server, 'server applied', { e, s })
            check(v.explain.key === 'manual' && !v.isSideOut && !v.endChangeNow, 'manual view', v)
            if (isDoublesSideout(setup)) check(s.serverNumber === (e.serverNumber === 1 ? 1 : 2), 'server number applied', { e, s })
          }
          check(s.winner === expectedWinner(s.score, setup.format), 'winner recomputed', s)
          check(teamOf(s.server) === s.servingTeam, 'server on the serving team', s)
          check(isDoublesSideout(setup) ? s.serverNumber === 1 || s.serverNumber === 2 : s.serverNumber === null, 'serverNumber domain', s)
          check(v.positions[v.receiver] === v.serverSide, 'diagonal receiver', v)
          if (isDoubles(setup)) {
            for (const t of TEAMS) {
              check(teamOf(s.startingServer[t]) === t, 'starting server stays on its team', s)
              check((v.positions[s.startingServer[t]] === 'right') === isEven(s.score[t]), 'starting server right iff even', { s, v })
            }
          } else {
            check(s.startingServer.A === 'A1' && s.startingServer.B === 'B1', 'singles players fixed', s)
            check(v.serverSide === (isEven(s.score[s.servingTeam]) ? 'right' : 'left'), 'singles parity', { s, v })
          }
        }
      }),
      { numRuns: NUM_RUNS },
    )
  })
})

describe('性質: ゲーム間（21.F.2）', () => {
  it('次のゲームはサーブ権だけが相手に移り、形式・名前・スターティングサーバーはそのまま。2回で元に戻る', () => {
    fc.assert(
      fc.property(setupArb, (setup) => {
        const next = nextGameSetup(setup)
        check(next.firstServingTeam === other(setup.firstServingTeam), 'first serve switches', next)
        check(JSON.stringify({ ...next, firstServingTeam: setup.firstServingTeam }) === JSON.stringify(setup), 'everything else kept', next)
        check(JSON.stringify(nextGameSetup(next)) === JSON.stringify(setup), 'two games later it is the same', next)
        const s0 = initialState(next)
        check(s0.servingTeam === next.firstServingTeam && teamOf(s0.server) === next.firstServingTeam, 'new first server', s0)
        check(s0.score.A === 0 && s0.score.B === 0 && s0.winner === null && s0.rallies === 0, 'fresh game', s0)
        if (isDoublesSideout(setup)) check(s0.serverNumber === 2, 'each game starts at 0-0-2', s0)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  forEachState('isOver は勝者がいるときだけ true', (_w, s) => {
    check(isOver(s) === (s.winner !== null), 'isOver mirrors winner', s)
  })
})

describe('性質のテスト自体の健全性', () => {
  it('入力の作り方は、形式×目標点×winBy の24通りすべてと、勝者が決まる列を十分に作る', () => {
    const seen = new Set<string>()
    let withWinner = 0
    const samples = fc.sample(fc.tuple(setupArb, seqArb), { numRuns: 600, seed: 42 })
    for (const [setup, seq] of samples) {
      seen.add(`${setup.format.kind}-${setup.format.scoring}-${setup.format.target}-${setup.format.winBy}`)
      if (replay(setup, rallies(seq)).winner) withWinner += 1
    }
    expect(seen.size).toBe(24)
    expect(withWinner).toBeGreaterThan(100)
  })
})

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o as Record<string, unknown>).forEach((v) => deepFreeze(v))
    Object.freeze(o)
  }
  return o
}
