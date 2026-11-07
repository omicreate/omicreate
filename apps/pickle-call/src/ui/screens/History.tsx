// 履歴。終わったゲームを新しい順に並べる（日時・形式・最終スコア・勝者・名前）。ストリークは出さない。
import { useEffect, useMemo, useState } from 'react'
import { teamLabel, teamName } from '../../domain/speech-text'
import type { Lang, Setup, Team } from '../../domain/types'
import { IconTrash } from '../components/Icons'
import { Modal } from '../components/Modal'
import { href } from '../router'
import { useApp } from '../store'
import type { GameRecord } from '../store'
import { formatLabel, gamesText, PageHead } from './Home'
import './screens.css'

const TEAMS: Team[] = ['A', 'B']

function dateFormatter(lang: Lang, withYear: boolean) {
  return new Intl.DateTimeFormat(lang === 'ja' ? 'ja-JP' : 'en-US', {
    ...(withYear ? { year: 'numeric' } : {}),
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 名前を表示するための仮の設定（履歴には名前と形式だけが残る） */
const setupOf = (r: GameRecord): Setup => ({
  format: r.format,
  names: r.names ?? {},
  startingServer: { A: 'A1', B: 'B1' },
  firstServingTeam: 'A',
  rulesetId: r.rulesetId,
})

function Row({ r, lang, now }: { r: GameRecord; lang: Lang; now: Date }) {
  const { t } = useApp()
  const start = new Date(r.startedAt)
  const when = dateFormatter(lang, start.getFullYear() !== now.getFullYear()).format(start)
  const minutes = Math.max(1, Math.round((r.endedAt - r.startedAt) / 60000))
  const setup = setupOf(r)
  const names = TEAMS.map((team) => ({ team, name: teamName(team, setup, lang) })).filter((x) => x.name !== teamLabel(x.team, lang))

  return (
    <li className="hs-item">
      <div className="hs-meta">
        <time className="num" dateTime={start.toISOString()}>
          {when}
        </time>
        <span aria-hidden="true">·</span>
        <span className="num">{t('history.minutes', { n: minutes })}</span>
      </div>
      <p className="hs-format">{formatLabel(r.format, t)}</p>
      <p className="visually-hidden">{`${teamLabel('A', lang)} ${r.score.A} ${t('home.vs')} ${teamLabel('B', lang)} ${r.score.B}`}</p>
      <div className="hs-score" aria-hidden="true">
        {TEAMS.map((team, i) => (
          <span key={team} className={`hs-side ${r.winner === team ? 'is-win' : ''}`}>
            {i === 1 && (
              <span className="hs-dash" aria-hidden="true">
                –
              </span>
            )}
            <span className={`tag tag-${team.toLowerCase()}`}>{team}</span>
            <span className="hs-pts num">{r.score[team]}</span>
          </span>
        ))}
      </div>
      <p className="hs-winner">
        <span className={`hs-crown hs-crown-${r.winner.toLowerCase()}`} aria-hidden="true" />
        {t('history.won', { team: teamLabel(r.winner, lang) })}
        <span className="hs-rallies muted num"> · {t('history.rallies', { n: r.rallies })}</span>
      </p>
      {names.length > 0 && (
        <p className="hs-names">
          {names.map(({ team, name }) => (
            <span key={team} className="hs-name">
              <span className={`hs-name-team hs-name-${team.toLowerCase()}`}>{team}</span> {name}
            </span>
          ))}
        </p>
      )}
    </li>
  )
}

export function History() {
  const { t, lang, history, actions } = useApp()
  const [confirm, setConfirm] = useState(false)
  const [toast, setToast] = useState('')
  const now = useMemo(() => new Date(), [])
  const list = useMemo(() => [...history].sort((a, b) => b.endedAt - a.endedAt), [history])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(id)
  }, [toast])

  return (
    <main className="page hs">
      <PageHead title={t('history.title')} />

      <p className="hs-count num">{gamesText(list.length, t)}</p>

      {list.length === 0 ? (
        <div className="hs-empty">
          <p className="hs-empty-title">{t('history.empty')}</p>
          <p className="muted small">{t('history.emptyBody')}</p>
          <a className="btn btn-primary btn-block" href={href('setup')}>
            {t('home.start')}
          </a>
        </div>
      ) : (
        <>
          <ul className="list hs-list" aria-label={t('history.list')}>
            {list.map((r) => (
              <Row key={r.id} r={r} lang={lang} now={now} />
            ))}
          </ul>
          <p className="xsmall muted hs-keep">{t('history.keep')}</p>
          <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirm(true)}>
            <IconTrash />
            {t('history.deleteAll')}
          </button>
        </>
      )}

      <Modal
        open={confirm}
        title={t('history.confirmTitle')}
        onClose={() => setConfirm(false)}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                actions.clearHistory()
                setConfirm(false)
                setToast(t('history.deleted'))
              }}
            >
              {t('history.deleteAll')}
            </button>
          </>
        }
      >
        <p>{t('history.confirmBody', { n: list.length })}</p>
      </Modal>

      <div role="status" className="sc-live">
        {toast && <p className="toast">{toast}</p>}
      </div>
    </main>
  )
}
