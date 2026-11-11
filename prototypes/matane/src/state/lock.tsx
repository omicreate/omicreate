/**
 * 画面ロック（4.11・7.4）。PIN を設定しているときだけ働く。
 * - 起動したとき・データベースを開き直したときはロックする（判定が済む前の最初の描画からロック画面を出す）
 * - 5分（設定の値）操作がない、またはアプリを離れて1分以上たって戻ったらロックする
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { INITIAL_PIN_ATTEMPTS, shouldAutoLock, type PinAttemptState } from '../domain'
import { useApp } from './AppState'

/**
 * 間違えた回数と待ちの終わり（「5回続けて間違えると30秒」）は、開いているデータベースの下書きストアに置く。
 * タブを開き直しても続くように（sessionStorage では開き直すたびに0に戻る。localStorage は 5.2 で activeDb だけ）
 */
export const PIN_ATTEMPTS_DRAFT = 'lock:attempts'
const CHECK_MS = 5_000

interface LockValue {
  /** PIN を設定している */
  enabled: boolean
  locked: boolean
  unlock: () => void
  lockNow: () => void
  attempts: PinAttemptState
  /** 保存してある回数を読み終えた（読み終えるまで入力させない） */
  attemptsReady: boolean
  setAttempts: (s: PinAttemptState) => void
}

const LockContext = createContext<LockValue | null>(null)

function parseAttempts(data: unknown): PinAttemptState {
  if (!data || typeof data !== 'object') return INITIAL_PIN_ATTEMPTS
  const v = data as Partial<PinAttemptState>
  if (typeof v.fails !== 'number') return INITIAL_PIN_ATTEMPTS
  return typeof v.lockedUntil === 'number' ? { fails: v.fails, lockedUntil: v.lockedUntil } : { fails: v.fails }
}

export function LockProvider({ children }: { children: ReactNode }) {
  const { data, openCount, status, repo } = useApp()
  const lock = data.settings?.lock
  const enabled = !!lock
  const autoLockMinutes = lock?.autoLockMinutes ?? 5
  const [locked, setLocked] = useState(false)
  // 何回目に開いたデータベースまでロックの判定を済ませたか
  const [handledOpen, setHandledOpen] = useState(-1)
  const [attempts, setAttemptsState] = useState<PinAttemptState>(INITIAL_PIN_ATTEMPTS)
  const [attemptsOpen, setAttemptsOpen] = useState(-1)
  const lastActivity = useRef(Date.now())
  const hiddenAt = useRef<number | undefined>(undefined)
  const repoRef = useRef(repo)
  repoRef.current = repo

  // 開いたばかりで判定がまだのときも、描く前からロックしている扱いにする
  // （ロック画面より先に、呼び名の入ったホームが一瞬でも描かれないように）
  const pendingOpen = status === 'ready' && handledOpen !== openCount

  // 開いたときにロックする（PIN を新しく設定しただけではロックしない）
  useEffect(() => {
    if (status !== 'ready' || handledOpen === openCount) return
    setHandledOpen(openCount)
    setLocked(enabled)
    lastActivity.current = Date.now()
  }, [status, openCount, enabled, handledOpen])

  // 開いたデータベースから、間違えた回数を読む
  useEffect(() => {
    if (status !== 'ready' || !repo) return
    let alive = true
    repo
      .getDraft(PIN_ATTEMPTS_DRAFT)
      .then((d) => {
        if (alive) setAttemptsState(parseAttempts(d?.data))
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setAttemptsOpen(openCount)
      })
    return () => {
      alive = false
    }
  }, [status, repo, openCount])

  useEffect(() => {
    if (!enabled) setLocked(false)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    // PIN を設定した（または時間を変えた）ところから数え直す。PIN がないあいだは操作を数えていないため
    lastActivity.current = Date.now()
    hiddenAt.current = undefined
    const touch = () => {
      lastActivity.current = Date.now()
    }
    const check = () => {
      if (shouldAutoLock({ nowMs: Date.now(), lastActivityMs: lastActivity.current, autoLockMinutes, hiddenAtMs: hiddenAt.current })) {
        setLocked(true)
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
      } else {
        check()
        hiddenAt.current = undefined
      }
    }
    const opts = { passive: true, capture: true } as const
    window.addEventListener('pointerdown', touch, opts)
    window.addEventListener('keydown', touch, opts)
    window.addEventListener('touchstart', touch, opts)
    window.addEventListener('wheel', touch, opts)
    document.addEventListener('visibilitychange', onVisibility)
    const timer = window.setInterval(check, CHECK_MS)
    return () => {
      window.removeEventListener('pointerdown', touch, opts)
      window.removeEventListener('keydown', touch, opts)
      window.removeEventListener('touchstart', touch, opts)
      window.removeEventListener('wheel', touch, opts)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
    }
  }, [enabled, autoLockMinutes])

  const unlock = useCallback(() => {
    lastActivity.current = Date.now()
    hiddenAt.current = undefined
    setLocked(false)
  }, [])

  const lockNow = useCallback(() => setLocked(true), [])

  const setAttempts = useCallback((next: PinAttemptState) => {
    setAttemptsState(next)
    const r = repoRef.current
    if (!r) return
    // 保存できなくても動く（画面の状態は変わっている）
    const write = next.fails === 0 && !next.lockedUntil ? r.deleteDraft(PIN_ATTEMPTS_DRAFT) : r.putDraft(PIN_ATTEMPTS_DRAFT, next)
    void write.catch(() => undefined)
  }, [])

  const attemptsReady = attemptsOpen === openCount
  const value = useMemo(
    () => ({ enabled, locked: enabled && (locked || pendingOpen), unlock, lockNow, attempts, attemptsReady, setAttempts }),
    [enabled, locked, pendingOpen, unlock, lockNow, attempts, attemptsReady, setAttempts],
  )
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>
}

export function useLock(): LockValue {
  const ctx = useContext(LockContext)
  if (!ctx) throw new Error('LockProvider の外では使えません')
  return ctx
}
