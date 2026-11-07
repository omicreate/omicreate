// 状態から、画面と読み上げに要るもの（コール・立ち位置・サーバー・レシーバー・説明）を導く純関数。
import { isDoublesSideout, other, partner, replay, rightPlayer, sideOf, singlesPlayer } from './engine'
import { RULESET, startKey } from './rules/usap-2026'
import type { ExplainKey, GameEvent, GameState, PlayerId, Setup, Side, Team, View } from './types'

export function playersOf(setup: Setup): PlayerId[] {
  return setup.format.kind === 'doubles' ? ['A1', 'A2', 'B1', 'B2'] : ['A1', 'B1']
}

export function callOf(state: GameState, setup: Setup): number[] {
  const s = state.score[state.servingTeam]
  const r = state.score[other(state.servingTeam)]
  // ダブルスのサイドアウト方式は3つの数字（6.B.2）。シングルスとラリー方式は2つ（6.B.1・14.A.3）
  return isDoublesSideout(setup) ? [s, r, state.serverNumber ?? 2] : [s, r]
}

export function receiverOf(state: GameState, setup: Setup, serverSide: Side): PlayerId {
  const rt = other(state.servingTeam)
  if (setup.format.kind === 'singles') return singlesPlayer(rt)
  // 対角: レシーブ側で、サーバーと同じ側（各チームから見た左右）に立つ人（5.B.3）
  const right = rightPlayer(rt, state.score[rt], state.startingServer)
  return serverSide === 'right' ? right : partner(right)
}

/** 次の1点で勝てるチーム。サイドアウト方式ではサーブ側だけが得点できる（4.A）。ラリー方式は両方（14.A.2・2026改訂） */
export function gamePointOf(state: GameState, setup: Setup): Team[] {
  if (state.winner) return []
  const { target, winBy, scoring } = setup.format
  const teams: Team[] = scoring === 'sideout' ? [state.servingTeam] : ['A', 'B']
  return teams.filter((t) => {
    const mine = state.score[t] + 1
    return mine >= target && mine - state.score[other(t)] >= winBy
  })
}

export function explainKeyOf(prev: GameState | null, next: GameState, setup: Setup, lastEvent?: GameEvent): ExplainKey {
  const { kind, scoring } = setup.format
  if (!prev || !lastEvent) return startKey(kind, scoring)
  if (lastEvent.type === 'set') return 'manual'
  if (next.winner && !prev.winner) return 'game'
  if (prev === next) return 'game' // 勝者が決まった後のラリー（無視された）
  const sameTeam = prev.servingTeam === next.servingTeam
  if (scoring === 'rally') {
    if (kind === 'singles') return sameTeam ? 'rally-point-singles' : 'rally-side-out-singles'
    return sameTeam ? 'rally-point' : 'rally-side-out'
  }
  if (kind === 'singles') return sameTeam ? 'point-singles' : 'side-out-singles'
  if (sameTeam) return prev.score[prev.servingTeam] !== next.score[next.servingTeam] ? 'point' : 'second-server'
  // 開始直後の1人だけのサーブ番が終わったとき
  return prev.sideOuts === 0 ? 'side-out-start' : 'side-out'
}

export function deriveView(prev: GameState | null, next: GameState, setup: Setup, lastEvent?: GameEvent): View {
  const positions: Partial<Record<PlayerId, Side>> = {}
  for (const p of playersOf(setup)) positions[p] = sideOf(p, next, setup)
  const serverSide = positions[next.server] ?? 'right'
  const receiver = receiverOf(next, setup, serverSide)
  const call = callOf(next, setup)
  const key = explainKeyOf(prev, next, setup, lastEvent)
  return {
    call,
    callText: call.join('-'),
    positions,
    server: next.server,
    serverSide,
    receiver,
    servingTeam: next.servingTeam,
    serverNumber: next.serverNumber,
    gamePoint: gamePointOf(next, setup),
    endChangeNow:
      lastEvent?.type === 'rally' && next.endChangeAt !== null && next.endChangeAt === next.rallies && prev?.endChangeAt === null,
    isSideOut: !!prev && lastEvent?.type === 'rally' && prev.servingTeam !== next.servingTeam,
    explain: { key, refs: RULESET.explainRefs[key] },
  }
}

/** イベント列から「直前の状態」「いまの状態」「いまの表示」をまとめて作る */
export function viewFromEvents(setup: Setup, events: readonly GameEvent[]) {
  const next = replay(setup, events)
  const prev = events.length ? replay(setup, events.slice(0, -1)) : null
  return { prev, state: next, view: deriveView(prev, next, setup, events[events.length - 1]) }
}

