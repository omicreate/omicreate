/**
 * 今日の日付（端末のローカル日付）。テストで時計を固定できるよう、必ず new Date() から得る。
 * アプリを開いたまま日付が変わっても、画面に戻ったとき（visibilitychange）に計算し直す（仕様 4.0）。
 */
import { useEffect, useState } from 'react'
import { todayLocal, type ISODate, type ISODateTime } from '../domain'

export function currentToday(): ISODate {
  return todayLocal(new Date())
}

export function nowISO(): ISODateTime {
  return new Date().toISOString()
}

export function useToday(): ISODate {
  const [today, setToday] = useState<ISODate>(currentToday)
  useEffect(() => {
    const update = () => {
      setToday((prev) => {
        const t = currentToday()
        return t === prev ? prev : t
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') update()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', update)
    window.addEventListener('pageshow', update)
    const timer = window.setInterval(update, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', update)
      window.removeEventListener('pageshow', update)
      window.clearInterval(timer)
    }
  }, [])
  return today
}
