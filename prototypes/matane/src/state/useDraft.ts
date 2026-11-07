/**
 * 入力中のフォームの下書き（仕様 6.1）:
 * 最後の入力から0.3秒後に保存し、pagehide と visibilitychange(hidden) ではすぐ保存する。
 * フォームを開いたとき下書きがあれば戻す。［保存］が成功したら clear() で消す。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createDraftSaver, type DraftSaver } from '../storage'
import { useApp } from './AppState'

export interface DraftState<T> {
  value: T
  set: (next: T | ((prev: T) => T)) => void
  /** 下書きの読み込みが終わった */
  ready: boolean
  /** 下書きから戻した */
  restored: boolean
  /** 下書きを消す（保存が成功したあと） */
  clear: () => Promise<void>
  /** すぐ保存する */
  flush: () => Promise<void>
}

export function useDraft<T>(
  formId: string,
  initial: () => T,
  restore: (data: unknown) => T | null = (d) => d as T,
): DraftState<T> {
  const { repo } = useApp()
  const [value, setValue] = useState<T>(initial)
  const [ready, setReady] = useState(false)
  const [restored, setRestored] = useState(false)
  const valueRef = useRef(value)
  const readyRef = useRef(false)
  const saverRef = useRef<DraftSaver<T> | null>(null)
  const restoreRef = useRef(restore)
  restoreRef.current = restore

  useEffect(() => {
    if (!repo) return
    let alive = true
    const saver = createDraftSaver<T>((data) => repo.putDraft(formId, data))
    saverRef.current = saver
    readyRef.current = false
    repo
      .getDraft(formId)
      .then((d) => {
        if (!alive) return
        if (d) {
          const v = restoreRef.current(d.data)
          if (v !== null) {
            valueRef.current = v
            setValue(v)
            setRestored(true)
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!alive) return
        readyRef.current = true
        setReady(true)
      })
    const flushNow = () => {
      void saver.flush().catch(() => undefined)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow()
    }
    window.addEventListener('pagehide', flushNow)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      alive = false
      window.removeEventListener('pagehide', flushNow)
      document.removeEventListener('visibilitychange', onVisibility)
      flushNow()
      if (saverRef.current === saver) saverRef.current = null
    }
  }, [repo, formId])

  const set = useCallback((next: T | ((prev: T) => T)) => {
    const v = typeof next === 'function' ? (next as (prev: T) => T)(valueRef.current) : next
    valueRef.current = v
    setValue(v)
    if (readyRef.current) saverRef.current?.schedule(v)
  }, [])

  const clear = useCallback(async () => {
    saverRef.current?.cancel()
    if (repo) await repo.deleteDraft(formId).catch(() => undefined)
  }, [repo, formId])

  const flush = useCallback(async () => {
    await saverRef.current?.flush()
  }, [])

  return { value, set, ready, restored, clear, flush }
}
