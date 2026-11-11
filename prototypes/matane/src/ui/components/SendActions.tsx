/**
 * ［LINEで送る］［コピー］と、そのあとの「送りましたか？」［送った］［送っていない］（4.3・4.5）。
 * 送るのは常に利用者。LINE は共有リンクを開くだけで、アプリからは何も送らない。
 */
import { useEffect, useRef, useState } from 'react'
import { lineShareUrl, type ContactVia } from '../../domain'
import { copyText, isOffline } from '../../state/platform'

export const LINE_OPEN_ERROR = 'LINEを開けませんでした。コピーして送ってください'
export const COPY_FALLBACK = '長押しでコピーしてください'

export function SendActions({
  text,
  onSent,
  onCopyFailed,
  busy,
}: {
  text: string
  onSent: (via: ContactVia) => void | Promise<void>
  /** クリップボードが使えないとき（文面を全選択する） */
  onCopyFailed: () => void
  busy?: boolean
}) {
  const [asked, setAsked] = useState<ContactVia | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const askRef = useRef<HTMLDivElement>(null)
  const empty = text.trim() === ''

  // 「送りましたか？」が下のタブの裏や画面の外に出ないよう、見える位置まで送る
  // （html の scroll-padding-bottom でタブの高さを空けている）
  useEffect(() => {
    if (!asked) return
    const el = askRef.current
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }, [asked])

  const onCopy = async () => {
    setError(null)
    const ok = await copyText(text)
    if (ok) {
      setInfo('コピーしました')
    } else {
      onCopyFailed()
      setInfo(COPY_FALLBACK)
    }
    setAsked('copy')
  }

  return (
    <div className="stack-sm">
      <div className="btn-pair">
        <a
          className="btn btn-primary"
          href={empty ? undefined : lineShareUrl(text)}
          target="_blank"
          rel="noopener noreferrer"
          role="button"
          aria-disabled={empty}
          onClick={(e) => {
            if (empty) {
              e.preventDefault()
              return
            }
            if (isOffline()) {
              e.preventDefault()
              setInfo(null)
              setError(LINE_OPEN_ERROR)
              return
            }
            setError(null)
            setInfo(null)
            setAsked('line_link')
          }}
        >
          LINEで送る
        </a>
        <button type="button" className="btn btn-primary" onClick={() => void onCopy()} disabled={empty}>
          コピー
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="hint" role="status">
          {info}
        </p>
      )}
      {asked && (
        <div className="notice" role="group" aria-labelledby="sent-q" ref={askRef}>
          <p className="notice-title" id="sent-q">
            送りましたか？
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void onSent(asked)}>
              送った
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => {
                setAsked(null)
                setInfo(null)
              }}
            >
              送っていない
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
