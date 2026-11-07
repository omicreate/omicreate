// 結果の画面。勝ったチーム、最終スコア（大）、ラリー数、サイドアウト数、所要時間。
// 次のゲーム（サーブは相手から）・同じメンバーで新しい試合・共有・1手戻す（押し間違えたとき）・ホーム。
import { useEffect, useRef, useState } from 'react'
import { teamLabel, teamName } from '../../domain/speech-text'
import type { Team } from '../../domain/types'
import { PUBLIC_URL } from '../../infra/counter'
import { shareResult } from '../../infra/share'
import { IconShare, IconUndo } from '../components/Icons'
import { href, navigate } from '../router'
import { useApp } from '../store'
import { formatLine } from './Play'
import './play.css'

/** ミリ秒を mm:ss にする（60分を超えても分で数える） */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round((Number.isFinite(ms) ? ms : 0) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function Result() {
  const { t, lang, current, game, actions } = useApp()
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const winner = game?.state.winner ?? null

  // 決着していないゲームならスコア係へ戻す。履歴は積まずに置きかえる（「戻る」でこの画面に来るたびに
  // スコア係を積み直し、スコア係から先へ戻れなくなるのを防ぐ）
  useEffect(() => {
    if (current && game && !winner) navigate('play', undefined, { replace: true })
  }, [current, game, winner])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  if (!current || !game) {
    return (
      <main className="page result">
        <h1 className="result-kicker">{t('result.heading')}</h1>
        <div className="stack">
          <p>{t('result.noGame')}</p>
          <a className="btn btn-primary btn-block" href={href('home')}>
            {t('nav.home')}
          </a>
        </div>
      </main>
    )
  }
  if (!winner) return null

  const setup = current.setup
  const { state } = game
  const loser: Team = winner === 'A' ? 'B' : 'A'
  const wName = teamName(winner, setup, lang)
  const lName = teamName(loser, setup, lang)
  const named = wName !== teamLabel(winner, lang)
  const lastAt = current.events[current.events.length - 1]?.at ?? current.startedAt
  const duration = formatDuration(lastAt - current.startedAt)
  const fmt = formatLine(setup, t)

  const showToast = (msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }

  const onShare = async () => {
    const text = t('result.shareText', {
      format: fmt,
      winner: wName,
      loser: lName,
      sw: state.score[winner],
      sl: state.score[loser],
    })
    const r = await shareResult(text, PUBLIC_URL)
    if (r === 'shared' || r === 'copied') actions.shared()
    if (r === 'copied') showToast(t('result.copied'))
    else if (r === 'failed') showToast(t('result.shareFailed'))
  }

  return (
    <main className="page result">
      <p className="result-kicker">
        <span>{t('result.title')}</span>
        <span className="muted">{fmt}</span>
      </p>

      <section className={`result-hero result-${winner.toLowerCase()}`} aria-labelledby="result-winner">
        {named && <span className={`tag tag-${winner.toLowerCase()}`}>{teamLabel(winner, lang)}</span>}
        <h1 id="result-winner" className="result-winner" data-testid="result-winner" data-team={winner}>
          {t('result.winner', { team: wName })}
        </h1>
        <p className="result-score num" data-testid="result-score">
          {state.score[winner]}-{state.score[loser]}
        </p>
        <p className="result-vs muted">{t('result.vs', { team: lName })}</p>
      </section>

      <dl className="result-stats">
        <div>
          <dt>{t('result.rallies')}</dt>
          <dd className="num" data-testid="result-rallies">
            {state.rallies}
          </dd>
        </div>
        <div>
          <dt>{t('result.sideOuts')}</dt>
          <dd className="num" data-testid="result-sideouts">
            {state.sideOuts}
          </dd>
        </div>
        <div>
          <dt>{t('result.duration')}</dt>
          <dd className="num" data-testid="result-duration">
            {duration}
          </dd>
        </div>
      </dl>

      <div className="result-actions">
        <div className="stack-sm">
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg result-next"
            data-testid="next-game"
            onClick={() => {
              actions.nextGame()
              navigate('play', undefined, { replace: true })
            }}
          >
            <span>{t('result.next')}</span>
            <span className="result-next-sub">{t('play.paren', { x: t('result.nextServe') })}</span>
          </button>
          <p className="xsmall muted result-note">{t('result.nextNote')}</p>
        </div>
        <a className="btn btn-block" href={href('setup', { from: 'last' })} data-testid="new-match">
          {t('result.newMatch')}
        </a>
        <div className="result-row">
          <button type="button" className="btn" data-testid="share" onClick={() => void onShare()}>
            <IconShare />
            {t('result.share')}
          </button>
          <button
            type="button"
            className="btn"
            data-testid="result-undo"
            onClick={() => {
              actions.undo()
              navigate('play', undefined, { replace: true })
            }}
          >
            <IconUndo />
            {t('result.undo')}
          </button>
        </div>
        <p className="xsmall muted result-note">{t('result.undoHint')}</p>
        <a className="btn btn-quiet btn-block" href={href('home')}>
          {t('nav.home')}
        </a>
      </div>

      <div role="status" aria-live="polite" className="result-toast-region">
        {toast && <span className="toast">{toast}</span>}
      </div>
    </main>
  )
}
