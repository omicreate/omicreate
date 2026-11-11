/**
 * 短いお知らせ（トースト）と、削除などの「元に戻す」（10秒、仕様 6.1）。
 * 取り消しの窓は1つだけ。新しい窓を開くと前の窓はすぐ確定し、画面を移っても確定する。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createUndoable, type Undoable } from '../storage'
import { useApp } from './AppState'
import { currentRouteHash, normalizeHash, subscribeRoute } from './router'

export interface UndoOffer {
  message: string
  undo: () => Promise<void> | void
  /** 10秒たつか画面を移ったときの確定（完全に消すなど） */
  commit?: () => Promise<void> | void
  /** この画面にいるあいだは確定しない（省略時は今の画面） */
  routeHash?: string
  /** 取り消したあとのお知らせ */
  undoneMessage?: string
  /**
   * 取り消す対象の目印（例 'customer:<id>'）。同じ目印の窓がまだ開いていれば、前の窓は確定せずに引き継ぐ
   * （二重に押したとき、前の窓の確定で完全に消してしまわないように）
   */
  key?: string
}

interface FeedbackValue {
  toast: (message: string) => void
  offerUndo: (offer: UndoOffer) => void
}

interface UndoEntry {
  id: number
  key?: string
  message: string
  handle: Undoable
  routeHash: string
  undoneMessage: string
}

const FeedbackContext = createContext<FeedbackValue | null>(null)

export const TOAST_MS = 3500

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { reload } = useApp()
  const [toastState, setToastState] = useState<{ id: number; text: string } | null>(null)
  const [undoState, setUndoState] = useState<UndoEntry | null>(null)
  const undoRef = useRef<UndoEntry | null>(null)
  const seq = useRef(0)

  const setUndo = (e: UndoEntry | null) => {
    undoRef.current = e
    setUndoState(e)
  }

  const toast = useCallback((text: string) => {
    seq.current += 1
    setToastState({ id: seq.current, text })
  }, [])

  useEffect(() => {
    if (!toastState) return
    const id = toastState.id
    const timer = window.setTimeout(() => setToastState((t) => (t && t.id === id ? null : t)), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toastState])

  const offerUndo = useCallback(
    (offer: UndoOffer) => {
      const prev = undoRef.current
      if (prev) {
        if (offer.key && prev.key === offer.key) prev.handle.dismiss()
        else void prev.handle.commitNow().catch(() => undefined)
      }
      seq.current += 1
      const id = seq.current
      const handle = createUndoable({
        undo: async () => {
          await offer.undo()
          await reload()
        },
        commit: async () => {
          try {
            await offer.commit?.()
          } finally {
            if (undoRef.current?.id === id) setUndo(null)
            await reload()
          }
        },
      })
      setUndo({
        id,
        key: offer.key,
        message: offer.message,
        handle,
        routeHash: normalizeHash(offer.routeHash ?? currentRouteHash()),
        undoneMessage: offer.undoneMessage ?? '元に戻しました',
      })
    },
    [reload],
  )

  // 画面を移ったら確定する
  useEffect(
    () =>
      subscribeRoute(() => {
        const cur = undoRef.current
        if (!cur) return
        if (normalizeHash(currentRouteHash()) !== cur.routeHash) {
          setUndo(null)
          void cur.handle.commitNow().catch(() => undefined)
        }
      }),
    [],
  )

  const onUndo = async () => {
    const cur = undoRef.current
    if (!cur) return
    setUndo(null)
    const ok = await cur.handle.undo().catch(() => false)
    if (ok) toast(cur.undoneMessage)
  }

  const value = useMemo(() => ({ toast, offerUndo }), [toast, offerUndo])

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="feedback">
        {toastState && (
          <div className="snackbar snackbar-toast" role="status" aria-live="polite" key={`t${toastState.id}`}>
            <span className="snackbar-text">{toastState.text}</span>
          </div>
        )}
        {undoState && (
          <div className="snackbar" role="status" aria-live="polite" key={`u${undoState.id}`}>
            <span className="snackbar-text">{undoState.message}</span>
            <button type="button" className="snackbar-action" onClick={() => void onUndo()}>
              元に戻す
            </button>
          </div>
        )}
      </div>
    </FeedbackContext.Provider>
  )
}

export function useFeedback(): FeedbackValue {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('FeedbackProvider の外では使えません')
  return ctx
}
