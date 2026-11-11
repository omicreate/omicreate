/** 設定などの自動保存: 最後の入力から0.3秒後に保存し、画面を離れるときはすぐ保存する */
import { useEffect, useMemo, useRef } from 'react'
import { createDraftSaver, type DraftSaver } from '../storage'

export function useAutoSave<T>(save: (value: T) => Promise<void>): DraftSaver<T> {
  const saveRef = useRef(save)
  saveRef.current = save
  const saver = useMemo(() => createDraftSaver<T>((v) => saveRef.current(v)), [])
  useEffect(() => {
    const flush = () => void saver.flush().catch(() => undefined)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [saver])
  return saver
}
