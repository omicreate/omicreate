// ホーム。アプリ名と一行の約束、はっきりした1つの主ボタン。続き・前回の設定・学ぶ・ガイド・履歴・設定へ。
// このファイルは、担当の画面（設定・履歴・設定・ガイド）が共有する小さな部品も持つ（PageHead・formatLabel など）。
import { useState } from 'react'
import type { ReactNode } from 'react'
import { RULESET } from '../../domain/rules/usap-2026'
import { teamLabel, teamName } from '../../domain/speech-text'
import type { Format, Lang, Setup } from '../../domain/types'
import type { T } from '../../i18n'
import { IconBack, IconBook, IconGear, IconList } from '../components/Icons'
import { Modal } from '../components/Modal'
import { href, navigate, parseHash } from '../router'
import { useApp } from '../store'
import './screens.css'

// ---------- 共有の部品 ----------

/** 画面の見出し（ホームへもどるボタンつき。試合中にスコア係から来たときは、スコア係へもどる） */
export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  const { t, game } = useApp()
  const toPlay = parseHash(location.hash).query.get('from') === 'play' && !!game && !game.state.winner
  return (
    <header className="page-head sc-head">
      <a className="icon-btn sc-back" href={href(toPlay ? 'play' : 'home')} aria-label={t(toPlay ? 'home.backToPlay' : 'home.backToHome')}>
        <IconBack />
      </a>
      <h1>{title}</h1>
      {children}
    </header>
  )
}

/** 形式の短い説明。例: ダブルス・サイドアウト・11点 */
export function formatLabel(f: Format, t: T): string {
  const sep = t('setup.short.sep')
  const parts = [
    t(f.kind === 'doubles' ? 'common.doubles' : 'common.singles'),
    t(f.scoring === 'sideout' ? 'setup.short.sideout' : 'setup.short.rally'),
    t('setup.short.points', { n: f.target }),
  ]
  if (f.winBy === 1) parts.push(t('setup.short.winBy1'))
  return parts.join(sep)
}

/** 「これまで N ゲーム」 */
export const gamesText = (n: number, t: T) => (n === 1 ? t('history.countOne') : t('history.count', { n }))

/** 外へのリンク（新しいタブ。読み上げには「新しいタブで開きます」を添える） */
export function ExtLink({ href: url, children, className }: { href: string; children: ReactNode; className?: string }) {
  const { t } = useApp()
  return (
    <a className={className} href={url} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sc-ext" aria-hidden="true">
        ↗
      </span>
      <span className="visually-hidden">{t('home.newTab')}</span>
    </a>
  )
}

/** コールの3つの数字と、それぞれの意味（ホームとガイドで使う図） */
export function CallAnatomy({ size = 'lg' }: { size?: 'lg' | 'md' }) {
  const { t } = useApp()
  const parts: [number, string, string][] = [
    [4, t('home.anatomyServing'), 'sc-anat-a'],
    [2, t('home.anatomyReceiving'), 'sc-anat-b'],
    [1, t('home.anatomyServer'), 'sc-anat-n'],
  ]
  return (
    <figure className={`sc-anat sc-anat-${size}`} aria-label={`${t('home.anatomy')} 4-2-1`}>
      {parts.map(([n, label, cls], i) => (
        <div key={i} className={`sc-anat-col ${cls}`}>
          <span className="sc-anat-num num">{n}</span>
          <span className="sc-anat-label">{label}</span>
        </div>
      ))}
    </figure>
  )
}

/** チームの呼び名を並べる。例: あおい・そら 対 りく・はな（名前がなければ空） */
export function matchup(setup: Setup, lang: Lang, t: T): string {
  const a = teamName('A', setup, lang)
  const b = teamName('B', setup, lang)
  if (a === teamLabel('A', lang) && b === teamLabel('B', lang)) return ''
  return `${a} ${t('home.vs')} ${b}`
}

/** 文ごとに分ける（「。」「. 」の後ろ）。文の途中で折り返しにくくする */
export const sentences = (text: string) => text.split(/(?<=[。.])\s*/).filter(Boolean)

/** 文の一部（日付など）を折り返さずに表示する */
export function KeepTogether({ text, part }: { text: string; part: string }) {
  const i = text.indexOf(part)
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <span className="sc-nowrap">{part}</span>
      {text.slice(i + part.length)}
    </>
  )
}

const IQ_URL = 'https://www.instagram.com/pickleballiq_jp/'
const ASOBI_URL = 'https://omicreate.github.io/pickle-asobi/?src=pb_call_cross'

/** 小さな印（ボール1つと3つの点） */
function Mark() {
  return (
    <svg className="hm-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="10" cy="16" r="2" fill="currentColor" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
      <circle cx="22" cy="16" r="2" fill="currentColor" />
    </svg>
  )
}

// ---------- ホーム ----------

export function Home() {
  const { t, lang, settings, setSettings, current, game, lastSetup, history, actions } = useApp()
  const [confirm, setConfirm] = useState(false)
  const inProgress = !!(current && game && !game.state.winner)
  const lastMatchup = lastSetup ? matchup(lastSetup, lang, t) : ''

  const startLast = () => {
    if (!lastSetup) return
    // iOS: 読み上げはクリックの処理の中で同期的に始める
    actions.startGame(lastSetup)
    navigate('play')
  }

  return (
    <main className="page hm">
      <header className="hm-hero">
        <p className="hm-eyebrow">
          <Mark />
          <span>{t('home.eyebrow')}</span>
        </p>
        <h1 className="hm-title">{t('app.name')}</h1>
        <p className="hm-tagline">
          {sentences(t('app.tagline')).map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </p>
        <CallAnatomy />
      </header>

      <div className="hm-actions">
        {inProgress && current && game && (
          <a className="hm-resume" href={href('play')}>
            <span className="hm-resume-text">
              <span className="hm-resume-label">{t('home.resume')}</span>
              <span className="hm-resume-sub">{formatLabel(current.setup.format, t)}</span>
            </span>
            <span className="hm-resume-call num">{game.view.callText}</span>
          </a>
        )}

        <a className="btn btn-primary btn-lg btn-block hm-start" href={href('setup')}>
          {t('home.start')}
        </a>

        {lastSetup && (
          <button
            type="button"
            className="btn btn-block hm-last"
            onClick={() => {
              if (inProgress && current && current.events.length > 0) setConfirm(true)
              else startLast()
            }}
          >
            <span className="hm-last-label">{t('home.startLast')}</span>
            <span className="hm-last-sub">
              {formatLabel(lastSetup.format, t)}
              {lastMatchup && <span className="hm-last-names">{lastMatchup}</span>}
            </span>
          </button>
        )}

        <a className="btn btn-block hm-learn" href={href('learn')}>
          <span className="hm-last-label">{t('home.learn')}</span>
          <span className="hm-last-sub">{t('home.learnSub')}</span>
        </a>
      </div>

      <nav className="hm-nav">
        <ul className="list hm-navlist">
          <li>
            <a className="hm-navlink" href={href('guide')}>
              <IconBook />
              <span className="hm-navtext">
                <span className="hm-navtitle">{t('home.guide')}</span>
                <span className="hm-navsub">{t('home.guideSub')}</span>
              </span>
              <span className="hm-chev" aria-hidden="true" />
            </a>
          </li>
          <li>
            <a className="hm-navlink" href={href('history')}>
              <IconList />
              <span className="hm-navtext">
                <span className="hm-navtitle">{t('home.history')}</span>
                <span className="hm-navsub num">{gamesText(history.length, t)}</span>
              </span>
              <span className="hm-chev" aria-hidden="true" />
            </a>
          </li>
          <li>
            <a className="hm-navlink" href={href('settings')}>
              <IconGear />
              <span className="hm-navtext">
                <span className="hm-navtitle">{t('home.settings')}</span>
                <span className="hm-navsub">{t('home.settingsSub')}</span>
              </span>
              <span className="hm-chev" aria-hidden="true" />
            </a>
          </li>
        </ul>
      </nav>

      <footer className="hm-foot">
        <p className="hm-promise">{t('home.promise')}</p>
        <p className="xsmall muted">
          <KeepTogether text={t('common.checkedAt', { title: RULESET.title[lang], date: RULESET.checkedAt })} part={lang === 'ja' ? `（${RULESET.checkedAt}）` : `(${RULESET.checkedAt})`} />
          <br />
          {t('app.notOfficial')}
        </p>

        <div className="hm-lang" role="group" aria-label={t('home.language')}>
          <div className="seg">
            <button type="button" lang="ja" aria-pressed={settings.lang === 'ja'} onClick={() => setSettings({ lang: 'ja' })}>
              日本語
            </button>
            <button type="button" lang="en" aria-pressed={settings.lang === 'en'} onClick={() => setSettings({ lang: 'en' })}>
              English
            </button>
          </div>
        </div>

        <ul className="hm-links" aria-label={t('home.links')}>
          <li>
            <ExtLink href={IQ_URL}>{t('home.iq')}</ExtLink>
          </li>
          <li>
            <ExtLink href={ASOBI_URL}>{t('home.asobi')}</ExtLink>
          </li>
        </ul>
      </footer>

      <Modal
        open={confirm}
        title={t('home.replaceTitle')}
        onClose={() => setConfirm(false)}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setConfirm(false)
                startLast()
              }}
            >
              {t('home.replaceOk')}
            </button>
          </>
        }
      >
        <p>{t('home.replaceBody', { call: game?.view.callText ?? '' })}</p>
      </Modal>
    </main>
  )
}
