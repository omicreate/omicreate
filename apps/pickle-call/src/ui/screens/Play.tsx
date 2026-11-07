// スコア係の画面（最重要）。上から: 上部バー、コール、サブ行、状態チップ、コート図、折りたたみ、ラリーボタン（下に固定）。
// 幅360・高さ740でも、コール・コート図・2つのボタンがスクロールなしで見える。折りたたみの中身はその下に出る。
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { rightPlayer } from '../../domain/engine'
import { displayName, gameText, voiceText } from '../../domain/speech-text'
import { RULESET } from '../../domain/rules/usap-2026'
import type { Lang, Setup, Team } from '../../domain/types'
import { acquireWakeLock, releaseWakeLock } from '../../infra/wakelock'
import { CallDisplay } from '../components/CallDisplay'
import { Court } from '../components/Court'
import { FixModal } from '../components/FixModal'
import { IconFlip, IconGear, IconMenu, IconPencil, IconReplay, IconUndo, IconVolume, IconVolumeOff, IconX } from '../components/Icons'
import { Modal } from '../components/Modal'
import { RallyButtons } from '../components/RallyButtons'
import type { T } from '../../i18n'
import { href, navigate } from '../router'
import type { Game } from '../store'
import { useApp } from '../store'
import './play.css'

/** 決着から結果画面へ移るまでの間（ミリ秒） */
const TO_RESULT_MS = 600

const WIDE_QUERY = '(min-width: 720px) and (min-height: 520px)'

function useMedia(query: string): boolean {
  const get = () => {
    try {
      return window.matchMedia(query).matches
    } catch {
      return false
    }
  }
  const [match, setMatch] = useState(get)
  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = window.matchMedia(query)
    } catch {
      return
    }
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [query])
  return match
}

/** 条番号を見出しつきで並べる。例: 5.B.5（1人目のサーバーが続く間）・5.B.3（…） */
export function formatRefs(refs: readonly string[], lang: Lang): string {
  return refs
    .map((r) => {
      const title = RULESET.refs[r]?.[lang]
      if (!title) return r
      return lang === 'ja' ? `${r}（${title}）` : `${r} (${title})`
    })
    .join(lang === 'ja' ? '・' : ', ')
}

export function formatLine(setup: Setup, t: T): string {
  const f = setup.format
  const base = t('play.formatLine', {
    kind: t(f.kind === 'doubles' ? 'common.doubles' : 'common.singles'),
    scoring: t(f.scoring === 'sideout' ? 'common.sideout' : 'common.rally'),
    target: f.target,
  })
  return f.winBy === 1 ? base + t('play.winBy1') : base
}

export function Play() {
  const { t, current, game } = useApp()
  if (!current || !game) {
    return (
      <main className="page play-empty">
        <h1 className="play-empty-title">{t('play.title')}</h1>
        <div className="stack">
          <p>{t('play.noGame')}</p>
          <p className="muted small">{t('play.noGameHint')}</p>
          <a className="btn btn-primary btn-block btn-lg" href={href('setup')}>
            {t('play.startNew')}
          </a>
          <a className="btn btn-block" href={href('home')}>
            {t('nav.home')}
          </a>
        </div>
      </main>
    )
  }
  return <Scorekeeper setup={current.setup} game={game} />
}

function Scorekeeper({ setup, game }: { setup: Setup; game: Game }) {
  const { t, lang, settings, setSettings, current, speechOk, actions } = useApp()
  const { state, view } = game
  const events = current?.events ?? []
  const flipped = current?.flipped ?? false
  const winner = state.winner
  const wide = useMedia(WIDE_QUERY)
  const uid = useId()

  const [menu, setMenu] = useState<null | 'menu' | 'quit'>(null)
  const [fixOpen, setFixOpen] = useState(false)
  const [openPanel, setOpenPanel] = useState<{ pos: boolean; why: boolean }>(() => ({ pos: wideNow(), why: false }))
  const panelRefs = { pos: useRef<HTMLDivElement>(null), why: useRef<HTMLDivElement>(null) }

  // 画面を消さない（試合が続いている間だけ）
  const running = !winner
  useEffect(() => {
    if (!settings.wakeLock || !running) return
    acquireWakeLock()
    return () => releaseWakeLock()
  }, [settings.wakeLock, running])

  // 決着したら0.6秒後に結果へ。開いた時点ですでに決着していたゲームは自動では移らない（戻るボタンで来た場合など）
  const winnerAtMount = useRef(winner)
  useEffect(() => {
    if (!winner) {
      winnerAtMount.current = null
      return
    }
    if (winnerAtMount.current === winner) return
    const id = window.setTimeout(() => navigate('result'), TO_RESULT_MS)
    return () => window.clearTimeout(id)
  }, [winner])

  const spoken = winner ? gameText(state, setup, lang) : voiceText(view, setup, lang, settings.numStyle)
  const ds = setup.format.kind === 'doubles' && setup.format.scoring === 'sideout'
  const serverLabel = !ds ? t('play.serverLabel') : view.serverNumber === 1 ? t('play.server1Label') : t('play.server2Label')
  const sideText = view.serverSide === 'right' ? t('common.fromRight') : t('common.fromLeft')

  const togglePanel = (key: 'pos' | 'why') => {
    const willOpen = !openPanel[key]
    setOpenPanel((p) => ({ ...p, [key]: willOpen }))
    if (willOpen && !wide) {
      // 狭い画面では中身がコート図の下に出るので、見える位置まで送る
      requestAnimationFrame(() => {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        panelRefs[key].current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
      })
    }
  }

  // ---- 部品 ----
  const head = (
    <div className="play-head">
      {!speechOk && <p className="play-notice">{t('common.voiceUnsupported')}</p>}
      <CallDisplay callText={view.callText} spoken={spoken} servingTeam={view.servingTeam} done={!!winner} />
      <p className="play-sub" data-testid="play-sub">
        <span className="play-sub-part">
          {serverLabel}: <strong>{displayName(view.server, setup)}</strong>
          {t('play.paren', { x: sideText })}
        </span>{' '}
        <span className="play-sub-part">
          <span aria-hidden="true">→ </span>
          {t('play.receiverLabel')}: <strong>{displayName(view.receiver, setup)}</strong>
        </span>
      </p>
      <div className="play-status" data-testid="play-status">
        {winner && <span className="tag tag-done">{t('play.gameOver')}</span>}
        {view.gamePoint.map((team) => (
          <span key={team} className={`tag tag-${team.toLowerCase()}`} data-testid={`status-gamepoint-${team}`}>
            {t('play.gamePoint', { team })}
          </span>
        ))}
        {view.isSideOut && !winner && (
          <span className="tag" data-testid="status-sideout">
            {t('play.sideOut')}
          </span>
        )}
        {view.endChangeNow && !winner && (
          <span className="tag tag-end" data-testid="status-endchange">
            {t('play.endChange', { n: RULESET.endChange[setup.format.target] })}
          </span>
        )}
      </div>
    </div>
  )

  const court = (
    <div className="play-court">
      <div className="play-court-fit">
        <Court setup={setup} view={view} flipped={flipped} />
      </div>
    </div>
  )

  const toggles = (
    <div className="play-toggles">
      <PanelToggle id={`${uid}-pos`} open={openPanel.pos} onToggle={() => togglePanel('pos')}>
        {t('play.posCheck')}
      </PanelToggle>
      <PanelToggle id={`${uid}-why`} open={openPanel.why} onToggle={() => togglePanel('why')}>
        {t('play.why')}
      </PanelToggle>
    </div>
  )

  const panels = (
    <div className="play-panels">
      <div className="play-panel" id={`${uid}-pos`} ref={panelRefs.pos} role="region" aria-label={t('play.posCheck')} hidden={!openPanel.pos}>
        <h2 className="play-panel-title">{t('play.posCheck')}</h2>
        <PositionCheck setup={setup} game={game} />
      </div>
      <div className="play-panel" id={`${uid}-why`} ref={panelRefs.why} role="region" aria-label={t('play.why')} hidden={!openPanel.why}>
        <h2 className="play-panel-title">{t('play.why')}</h2>
        <p>{RULESET.summaries[view.explain.key][lang]}</p>
        <RuleRefs refs={view.explain.refs} />
        {setup.format.scoring === 'rally' && <p className="note">{t('play.rallyProvisional')}</p>}
        <a className="play-guide-link small" href={href('guide')}>
          {t('play.moreInGuide')}
        </a>
      </div>
    </div>
  )

  return (
    <main className="play">
      <h1 className="visually-hidden">{t('play.title')}</h1>
      <div className="play-bar">
        <button
          type="button"
          className="btn btn-quiet play-undo"
          data-testid="undo"
          aria-label={t('play.undo')}
          disabled={!events.length}
          onClick={() => actions.undo()}
        >
          <IconUndo />
          <span aria-hidden="true">{t('play.undo')}</span>
        </button>
        <span className="play-bar-space" />
        {speechOk && (
          <>
            <button
              type="button"
              className="icon-btn"
              data-testid="voice-toggle"
              aria-label={t('play.voice')}
              aria-pressed={settings.voice}
              onClick={() => setSettings({ voice: !settings.voice })}
            >
              {settings.voice ? <IconVolume /> : <IconVolumeOff />}
            </button>
            <button
              type="button"
              className="icon-btn"
              data-testid="say-again"
              aria-label={t('play.sayAgain')}
              disabled={!settings.voice}
              onClick={() => actions.speakAgain()}
            >
              <IconReplay />
            </button>
          </>
        )}
        <button
          type="button"
          className="icon-btn"
          data-testid="menu"
          aria-label={t('play.menu')}
          aria-haspopup="dialog"
          onClick={() => setMenu('menu')}
        >
          <IconMenu />
        </button>
      </div>

      {wide ? (
        <div className="play-main play-main-wide">
          {court}
          <div className="play-side">
            {head}
            {winner && <SeeResult />}
            {toggles}
            {panels}
          </div>
        </div>
      ) : (
        <div className="play-main">
          <div className="play-stage">
            {head}
            {court}
            {winner && <SeeResult />}
            {toggles}
          </div>
          {panels}
        </div>
      )}

      <div className="play-foot">
        <RallyButtons setup={setup} disabled={!!winner} onRally={(team: Team) => actions.rally(team)} />
      </div>

      <Modal
        open={menu !== null}
        title={menu === 'quit' ? t('play.quitTitle') : t('play.menu')}
        onClose={() => setMenu(null)}
        actions={
          menu === 'quit' ? (
            <>
              <button type="button" className="btn" onClick={() => setMenu(null)}>
                {t('play.quitNo')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                data-testid="quit-confirm"
                onClick={() => {
                  setMenu(null)
                  actions.quit()
                  navigate('home')
                }}
              >
                {t('play.quit')}
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => setMenu(null)}>
              {t('nav.close')}
            </button>
          )
        }
      >
        {menu === 'quit' ? (
          <p>{t('play.quitBody')}</p>
        ) : (
          <>
            <p className="muted small">{formatLine(setup, t)}</p>
            <ul className="list play-menu">
              <li>
                <button
                  type="button"
                  className="play-menu-item"
                  data-testid="menu-fix"
                  onClick={() => {
                    setMenu(null)
                    setFixOpen(true)
                  }}
                >
                  <IconPencil />
                  {t('play.fix')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="play-menu-item"
                  data-testid="menu-flip"
                  onClick={() => {
                    actions.toggleFlip()
                    setMenu(null)
                  }}
                >
                  <IconFlip />
                  {t('play.flip')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="play-menu-item"
                  data-testid="menu-settings"
                  onClick={() => {
                    setMenu(null)
                    navigate('settings')
                  }}
                >
                  <IconGear />
                  {t('play.settings')}
                </button>
              </li>
              <li>
                <button type="button" className="play-menu-item play-menu-danger" data-testid="menu-quit" onClick={() => setMenu('quit')}>
                  <IconX />
                  {t('play.quit')}
                </button>
              </li>
            </ul>
          </>
        )}
      </Modal>

      <FixModal open={fixOpen} onClose={() => setFixOpen(false)} setup={setup} state={state} flipped={flipped} onSave={(input) => actions.fix(input)} />
    </main>
  )
}

function wideNow(): boolean {
  try {
    return window.matchMedia(WIDE_QUERY).matches
  } catch {
    return false
  }
}

function SeeResult() {
  const { t } = useApp()
  return (
    <a className="btn btn-primary btn-block play-see-result" href={href('result')}>
      {t('play.seeResult')}
    </a>
  )
}

function PanelToggle({ id, open, onToggle, children }: { id: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button type="button" className="play-toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}>
      <span>{children}</span>
      <span className="play-toggle-mark" aria-hidden="true" />
    </button>
  )
}

/** 条番号と短い見出しの一覧 */
function RuleRefs({ refs }: { refs: readonly string[] }) {
  const { t, lang } = useApp()
  if (!refs.length) return null
  return (
    <div>
      <p className="play-refs-title">{t('play.rules')}</p>
      <ul className="play-refs">
        {refs.map((r) => (
          <li key={r}>
            <span className="play-ref-no num">{r}</span>
            <span>{RULESET.refs[r]?.[lang] ?? ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 立ち位置チェック: 各チームの点数の偶奇から、だれが右に立つかを示す（5.B.3。シングルスは 5.A.1） */
function PositionCheck({ setup, game }: { setup: Setup; game: Game }) {
  const { t } = useApp()
  const { state, view } = game
  if (setup.format.kind === 'singles') {
    const n = state.score[view.servingTeam]
    const even = n % 2 === 0
    return (
      <>
        <p data-testid="pos-singles">
          {t('play.posSingles', {
            name: displayName(view.server, setup),
            n,
            parity: t(even ? 'play.even' : 'play.odd'),
            side: view.serverSide === 'right' ? t('common.fromRight') : t('common.fromLeft'),
          })}
        </p>
        <p className="muted">{t('play.posRuleSingles')}</p>
        <RuleRefs refs={['5.A.1']} />
      </>
    )
  }
  return (
    <>
      <ul className="play-pos">
        {(['A', 'B'] as const).map((team) => {
          const n = state.score[team]
          const starter = state.startingServer[team]
          const right = rightPlayer(team, n, state.startingServer)
          return (
            <li key={team} data-testid={`pos-${team}`}>
              <span className={`tag tag-${team.toLowerCase()}`}>{team}</span>
              <span className="num">
                {n % 2 === 0
                  ? t('play.posEven', { n, name: displayName(starter, setup) })
                  : t('play.posOdd', { n, name: displayName(right, setup), starter: displayName(starter, setup) })}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="muted">{t('play.posRuleDoubles')}</p>
      <RuleRefs refs={['5.B.3']} />
    </>
  )
}
