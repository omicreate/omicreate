// 得点の状態機械。reduce(state, event) の純関数だけで書き、画面には触れない。
// 根拠は USA Pickleball Official Rulebook 2026（条番号は rules/usap-2026.ts）。
import { RULESET } from './rules/usap-2026'
import type { GameEvent, GameState, PlayerId, Setup, Side, Team } from './types'

export const other = (t: Team): Team => (t === 'A' ? 'B' : 'A')
export const teamOf = (p: PlayerId): Team => (p[0] === 'A' ? 'A' : 'B')
export const partner = (p: PlayerId): PlayerId =>
  (({ A1: 'A2', A2: 'A1', B1: 'B2', B2: 'B1' }) as const)[p]
export const isEven = (n: number) => n % 2 === 0

/** シングルスの選手（各チーム1人） */
export const singlesPlayer = (t: Team): PlayerId => (t === 'A' ? 'A1' : 'B1')

/**
 * ダブルスで、そのチームの点数のとき右に立つべき人（5.B.3）。
 * スターティングサーバーは自チームの点が 0 か偶数なら右、奇数なら左。パートナーはその逆。
 */
export function rightPlayer(team: Team, score: number, startingServer: Record<Team, PlayerId>): PlayerId {
  const s = startingServer[team]
  return isEven(score) ? s : partner(s)
}

/** 各選手の左右（各チーム自身から見た左右）。シングルスは両者ともサーバーの点の偶奇の側（5.A.1） */
export function sideOf(player: PlayerId, state: GameState, setup: Setup): Side {
  const team = teamOf(player)
  if (setup.format.kind === 'singles') {
    return isEven(state.score[state.servingTeam]) ? 'right' : 'left'
  }
  return rightPlayer(team, state.score[team], state.startingServer) === player ? 'right' : 'left'
}

export const isDoublesSideout = (setup: Setup) =>
  setup.format.kind === 'doubles' && setup.format.scoring === 'sideout'

export function initialState(setup: Setup): GameState {
  const team = setup.firstServingTeam
  const startingServer =
    setup.format.kind === 'doubles' ? { ...setup.startingServer } : { A: 'A1' as PlayerId, B: 'B1' as PlayerId }
  return {
    score: { A: 0, B: 0 },
    servingTeam: team,
    // 各ゲームの最初は、スターティングサーバー1人だけが「2人目」としてサーブする（5.B・5.B.2）
    serverNumber: isDoublesSideout(setup) ? 2 : null,
    server: setup.format.kind === 'doubles' ? startingServer[team] : singlesPlayer(team),
    startingServer,
    winner: null,
    rallies: 0,
    sideOuts: 0,
    endChangeAt: null,
  }
}

/** 目標点に達し、差が winBy 以上なら勝ち（4.B・15.C） */
export function winnerOf(score: Record<Team, number>, setup: Setup): Team | null {
  const { target, winBy } = setup.format
  for (const t of ['A', 'B'] as const) {
    if (score[t] >= target && score[t] - score[other(t)] >= winBy) return t
  }
  return null
}

function markEndChange(state: GameState, setup: Setup): number | null {
  if (state.endChangeAt !== null) return state.endChangeAt
  const threshold = RULESET.endChange[setup.format.target]
  return Math.max(state.score.A, state.score.B) >= threshold ? state.rallies : null
}

function serverAfterSideOut(team: Team, score: Record<Team, number>, state: GameState, setup: Setup): PlayerId {
  return setup.format.kind === 'doubles' ? rightPlayer(team, score[team], state.startingServer) : singlesPlayer(team)
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(99, Math.max(0, Math.trunc(n)))
}

export function applyEvent(state: GameState, event: GameEvent, setup: Setup): GameState {
  if (event.type === 'set') return applySet(state, event, setup)

  // 勝者が決まった後のラリーは無視する（同じ参照を返す）
  if (state.winner) return state

  const winner = event.winner
  const score = { ...state.score }
  let { servingTeam, serverNumber, server, sideOuts } = state

  if (setup.format.scoring === 'sideout') {
    if (winner === servingTeam) {
      // サーブ側だけが得点し、同じサーバーが左右を替えて続ける（4.A・5.A.2・5.B.5・5.B.6）
      score[winner] += 1
    } else if (setup.format.kind === 'doubles' && serverNumber === 1) {
      // 1人目の失点で、パートナーが2人目としていまの位置からサーブ（5.B.5）
      serverNumber = 2
      server = partner(server)
    } else {
      // 2人目（またはシングルスのサーバー、開始時の1人）の失点でサイドアウト（5.A.3・5.B・5.B.6）
      sideOuts += 1
      servingTeam = other(servingTeam)
      server = serverAfterSideOut(servingTeam, score, state, setup)
      serverNumber = setup.format.kind === 'doubles' ? 1 : null
    }
  } else {
    // ラリー方式（仮規則 14.A）: 勝った側に毎回1点。ダブルスでもサーバーは1人（14.A.5）
    score[winner] += 1
    if (winner !== servingTeam) {
      sideOuts += 1
      servingTeam = winner
      // サイドアウト後は、新しい点数で右に正しく立つ人がサーブ（14.A.4。立ち位置は 5.B.3 のまま）
      server = serverAfterSideOut(winner, score, state, setup)
    }
    serverNumber = null
  }

  const next: GameState = {
    ...state,
    score,
    servingTeam,
    serverNumber,
    server,
    sideOuts,
    rallies: state.rallies + 1,
    winner: winnerOf(score, setup),
  }
  return { ...next, endChangeAt: markEndChange(next, setup) }
}

function applySet(state: GameState, event: Extract<GameEvent, { type: 'set' }>, setup: Setup): GameState {
  const score = { A: clampScore(event.score.A), B: clampScore(event.score.B) }
  const doubles = setup.format.kind === 'doubles'
  const servingTeam = event.servingTeam
  const startingServer = doubles
    ? {
        A: teamOf(event.startingServer.A) === 'A' ? event.startingServer.A : state.startingServer.A,
        B: teamOf(event.startingServer.B) === 'B' ? event.startingServer.B : state.startingServer.B,
      }
    : { A: 'A1' as PlayerId, B: 'B1' as PlayerId }
  // サーバーはサーブ側の選手でなければならない。違えば、点数どおりに右に立つ人にする
  let server = event.server
  if (!doubles) server = singlesPlayer(servingTeam)
  else if (teamOf(server) !== servingTeam) server = rightPlayer(servingTeam, score[servingTeam], startingServer)
  const serverNumber = isDoublesSideout(setup) ? (event.serverNumber === 1 ? 1 : 2) : null
  const next: GameState = {
    ...state,
    score,
    servingTeam,
    serverNumber,
    server,
    startingServer,
    winner: winnerOf(score, setup),
  }
  return { ...next, endChangeAt: markEndChange(next, setup) }
}

export function replay(setup: Setup, events: readonly GameEvent[]): GameState {
  let s = initialState(setup)
  for (const e of events) s = applyEvent(s, e, setup)
  return s
}

export const isOver = (state: GameState) => state.winner !== null

/**
 * 次のゲームの設定（エンドとサーブ権を交代。21.F.2）。スターティングサーバーは変えてよい（21.F.3）が、既定はそのまま。
 * startingServer を渡すと（前のゲームの終わりの状態。「スコアを直す」で直したものを含む）、ダブルスではそれを引き継ぐ
 */
export function nextGameSetup(setup: Setup, startingServer?: Record<Team, PlayerId>): Setup {
  const next: Setup = { ...setup, firstServingTeam: other(setup.firstServingTeam) }
  if (setup.format.kind !== 'doubles' || !startingServer) return next
  const keep = (t: Team) => (startingServer[t] && teamOf(startingServer[t]) === t ? startingServer[t] : setup.startingServer[t])
  return { ...next, startingServer: { A: keep('A'), B: keep('B') } }
}
