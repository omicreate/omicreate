// 試合の設定。形式・方式・点数・2点差・名前（任意）・最初にサーブするチームを選び、「開始」で試合をはじめる。
// 「開始」はクリックの処理の中で同期的に startGame を呼ぶ（iOS で最初のコールを読み上げるため）。
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { partner } from '../../domain/engine'
import { cleanName } from '../../domain/speech-text'
import type { Format, Kind, PlayerId, Scoring, Setup as GameSetup, Target, Team } from '../../domain/types'
import { Modal } from '../components/Modal'
import { href, navigate } from '../router'
import { useApp } from '../store'
import { PageHead } from './Home'
import './screens.css'

type NameFields = Record<Team, { right: string; left: string }>

const TEAMS: Team[] = ['A', 'B']
const TARGETS: Target[] = [11, 15, 21]
const NAME_MAX = 10

const DEFAULT_FORMAT: Format = { kind: 'doubles', scoring: 'sideout', target: 11, winBy: 2 }

/** 前回の設定から入力欄を作る。スターティングサーバーの名前を「右に立つ人」の欄に入れる */
function fieldsFrom(last: GameSetup | null): NameFields {
  const f: NameFields = { A: { right: '', left: '' }, B: { right: '', left: '' } }
  if (!last) return f
  for (const team of TEAMS) {
    const ss: PlayerId = last.startingServer[team] ?? (`${team}1` as PlayerId)
    f[team].right = cleanName(last.names[ss])
    f[team].left = last.format.kind === 'doubles' ? cleanName(last.names[partner(ss)]) : ''
  }
  return f
}

/** 入力から試合の設定を作る（名前は前後の空白と制御文字を除き、10文字まで） */
function buildSetup(format: Format, fields: NameFields, firstServingTeam: Team): GameSetup {
  const names: GameSetup['names'] = {}
  for (const team of TEAMS) {
    const right = cleanName(fields[team].right)
    const left = cleanName(fields[team].left)
    if (right) names[`${team}1` as PlayerId] = right
    if (format.kind === 'doubles' && left) names[`${team}2` as PlayerId] = left
  }
  return { format, names, startingServer: { A: 'A1', B: 'B1' }, firstServingTeam, rulesetId: 'usap-2026' }
}

/** 名前の欄で Enter（「次へ」）を押したら次の欄へ。最後の欄ならキーボードを閉じる（誤って開始しないように） */
function nextOnEnter(e: KeyboardEvent<HTMLDivElement>) {
  const el = e.target as HTMLElement
  if (e.key !== 'Enter' || !(el instanceof HTMLInputElement) || el.type !== 'text') return
  e.preventDefault()
  const inputs = Array.from(e.currentTarget.querySelectorAll<HTMLInputElement>('input.input'))
  const next = inputs[inputs.indexOf(el) + 1]
  if (next) next.focus()
  else el.blur()
}

export function Setup() {
  const { t, settings, speechOk, lastSetup, current, game, actions } = useApp()
  // ?from=last でも、前回の設定があればそれを下敷きにする
  const [format, setFormat] = useState<Format>(() => (lastSetup ? { ...lastSetup.format } : DEFAULT_FORMAT))
  const [fields, setFields] = useState<NameFields>(() => fieldsFrom(lastSetup))
  const [first, setFirst] = useState<Team>(() => lastSetup?.firstServingTeam ?? 'A')
  const [confirm, setConfirm] = useState(false)

  const doubles = format.kind === 'doubles'
  const startCall = doubles && format.scoring === 'sideout' ? '0-0-2' : '0-0'
  const inProgress = !!(current && game && !game.state.winner && current.events.length > 0)

  const patch = (p: Partial<Format>) => setFormat((f) => ({ ...f, ...p }))
  const setName = (team: Team, slot: 'right' | 'left', value: string) =>
    setFields((f) => ({ ...f, [team]: { ...f[team], [slot]: value } }))

  const start = () => {
    const setup = buildSetup(format, fields, first)
    // iOS: 読み上げとWake Lockはクリックの処理の中で同期的に始める
    actions.startGame(setup)
    // 設定の画面は履歴に残さない（試合中に「戻る」で設定へ戻り、「開始」で試合を消してしまわないように。戻るとホーム）
    navigate('play', undefined, { replace: true })
  }

  // 進行中の試合があるときは、置きかえる前に確かめる（ホームの「前回の設定ではじめる」と同じ）
  const onStart = () => {
    if (inProgress) setConfirm(true)
    else start()
  }

  const kinds: [Kind, string][] = [
    ['doubles', t('common.doubles')],
    ['singles', t('common.singles')],
  ]
  const scorings: [Scoring, string, string][] = [
    ['sideout', t('common.sideout'), t('setup.standard')],
    ['rally', t('common.rally'), t('setup.provisional')],
  ]

  return (
    <main className="page su">
      <PageHead title={t('setup.title')} />

      <div className="su-form" onKeyDown={nextOnEnter}>
        <fieldset className="su-group">
          <legend className="su-legend">{t('setup.format')}</legend>
          <div className="seg">
            {kinds.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={format.kind === k} onClick={() => patch({ kind: k })}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="su-group">
          <legend className="su-legend">{t('setup.scoring')}</legend>
          <div className="seg su-seg-2line">
            {scorings.map(([s, label, sub]) => (
              <button key={s} type="button" aria-pressed={format.scoring === s} onClick={() => patch({ scoring: s })}>
                <span>{label}</span>
                <span className="su-seg-sub">{sub}</span>
              </button>
            ))}
          </div>
          {format.scoring === 'rally' && (
            <p className="note su-note" role="note">
              {t('setup.rallyNote')}
            </p>
          )}
        </fieldset>

        <fieldset className="su-group">
          <legend className="su-legend">{t('setup.target')}</legend>
          <div className="seg">
            {TARGETS.map((n) => (
              <button key={n} type="button" className="num" aria-pressed={format.target === n} onClick={() => patch({ target: n })}>
                {t('setup.targetOption', { n })}
              </button>
            ))}
          </div>
          <label className="switch-row su-switch">
            <span className="su-switch-text">
              <span className="su-switch-label">{t('setup.winBy2')}</span>
              <span className="su-hint" id="su-winby-hint">
                {t('setup.winBy2Hint')}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={format.winBy === 2}
              aria-describedby="su-winby-hint"
              onChange={(e) => patch({ winBy: e.target.checked ? 2 : 1 })}
            />
          </label>
        </fieldset>

        <fieldset className="su-group">
          <legend className="su-legend">{t('setup.names')}</legend>
          {doubles && <p className="su-hint">{t('setup.namesHint')}</p>}
          <div className={`su-teams ${doubles ? '' : 'su-teams-singles'}`}>
            {TEAMS.map((team) => (
              <div key={team} className={`su-team su-team-${team.toLowerCase()}`} role="group" aria-labelledby={`su-team-${team}`}>
                <p className="su-team-name" id={`su-team-${team}`}>
                  <span className={`tag tag-${team.toLowerCase()}`}>{team}</span>
                  {t('common.team', { team })}
                </p>
                <label className="field">
                  <span className="field-label">{doubles ? t('setup.right') : t('setup.player')}</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    maxLength={NAME_MAX}
                    placeholder={t('setup.blankAs', { id: `${team}1` })}
                    value={fields[team].right}
                    onChange={(e) => setName(team, 'right', e.target.value)}
                    data-testid={`name-${team}1`}
                  />
                </label>
                {doubles && (
                  <label className="field">
                    <span className="field-label">{t('setup.left')}</span>
                    <input
                      className="input"
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="next"
                      maxLength={NAME_MAX}
                      placeholder={t('setup.blankAs', { id: `${team}2` })}
                      value={fields[team].left}
                      onChange={(e) => setName(team, 'left', e.target.value)}
                      data-testid={`name-${team}2`}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
          <p className="note">{t('setup.namesNote')}</p>
        </fieldset>

        <fieldset className="su-group">
          <legend className="su-legend">{t('setup.first')}</legend>
          <div className="seg">
            {TEAMS.map((team) => (
              <button key={team} type="button" aria-pressed={first === team} onClick={() => setFirst(team)}>
                <span className={`su-dot su-dot-${team.toLowerCase()}`} aria-hidden="true" />
                {t('common.team', { team })}
              </button>
            ))}
          </div>
          <p className="su-hint">{t('setup.firstHint')}</p>
        </fieldset>

        <div className="su-startbar">
          {inProgress && game && (
            <p className="su-hint su-replace">
              {t('setup.replaceNote', { call: game.view.callText })}{' '}
              <a href={href('play')} data-testid="setup-resume">
                {t('home.resume')}
              </a>
            </p>
          )}
          <button type="button" className="btn btn-primary btn-lg btn-block su-start" data-testid="setup-start" onClick={onStart}>
            <span>{t('setup.start')}</span>
            <span className="su-start-sub num">{t('setup.startCall', { call: startCall })}</span>
          </button>
        </div>
        {settings.voice && speechOk && <p className="su-hint su-center su-voice">{t('setup.voiceHint')}</p>}
      </div>

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
              data-testid="setup-replace-confirm"
              onClick={() => {
                setConfirm(false)
                start()
              }}
            >
              {t('home.replaceOk')}
            </button>
          </>
        }
      >
        <p>{t('setup.replaceNote', { call: game?.view.callText ?? '' })}</p>
      </Modal>
    </main>
  )
}
