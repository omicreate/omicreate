/** 画面ロック（4.11・7.4）の判定。時刻はミリ秒で渡す（テストで固定できるように） */

/** 5回続けて間違えると30秒入力できない（仮の値） */
export const PIN_MAX_FAILS = 5
export const PIN_LOCKOUT_MS = 30_000
/** アプリを離れて1分以上たって戻ったらロック（仮の値） */
export const AWAY_LOCK_MS = 60_000

export interface PinAttemptState {
  fails: number
  lockedUntil?: number
}

export const INITIAL_PIN_ATTEMPTS: PinAttemptState = { fails: 0 }

/** 間違えたとき。5回目で30秒の待ちに入り、回数を0に戻す */
export function registerPinFailure(state: PinAttemptState, nowMs: number): PinAttemptState {
  const fails = state.fails + 1
  if (fails >= PIN_MAX_FAILS) return { fails: 0, lockedUntil: nowMs + PIN_LOCKOUT_MS }
  return { fails, lockedUntil: state.lockedUntil }
}

/** 入力できるまでの残り（ミリ秒）。0なら入力できる */
export function lockoutRemainingMs(state: PinAttemptState, nowMs: number): number {
  return state.lockedUntil && state.lockedUntil > nowMs ? state.lockedUntil - nowMs : 0
}

/**
 * ロックすべきか: 最後の操作から autoLockMinutes 分たった、
 * またはアプリを離れて（hidden）1分以上たって戻った。
 */
export function shouldAutoLock(input: {
  nowMs: number
  lastActivityMs: number
  autoLockMinutes: number
  hiddenAtMs?: number
}): boolean {
  if (input.nowMs - input.lastActivityMs >= input.autoLockMinutes * 60_000) return true
  if (input.hiddenAtMs != null && input.nowMs - input.hiddenAtMs >= AWAY_LOCK_MS) return true
  return false
}
