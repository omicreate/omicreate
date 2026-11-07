// 「スコアを直す」モーダル。点数・サーブ側・サーバー番号・サーバー・スターティングサーバーを選ぶ。
// 立ち位置は手で置かず、点数の偶奇から必ず導く。保存前に、いまの状態へ set を当てた結果を小さなコート図で見せる。
import { useId, useState } from 'react'
import { applyEvent, isDoublesSideout, rightPlayer, singlesPlayer, teamOf } from '../../domain/engine'
import { displayName, teamLabel } from '../../domain/speech-text'
import type { GameState, PlayerId, SetEvent, Setup, Team } from '../../domain/types'
import { deriveView } from '../../domain/view'
import type { FixInput } from '../store'
import { useApp } from '../store'
import { Court } from './Court'
import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
  setup: Setup
  state: GameState
  flipped: boolean
  /** 保存。読み上げのため、クリックの処理の中で同期的に呼ばれる */
  onSave: (input: FixInput) => void
}

export function FixModal({ open, onClose, setup, state, flipped, onSave }: Props) {
  const { t } = useApp()
  return (
    <Modal open={open} title={t('play.fixTitle')} onClose={onClose}>
      {open && <FixForm setup={setup} state={state} flipped={flipped} onClose={onClose} onSave={onSave} />}
    </Modal>
  )
}

/** 0〜99の整数にそろえる（空や不正な値は0） */
export function clampScore(raw: string | number): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return 0
  return Math.min(99, Math.max(0, Math.trunc(n)))
}

const TEAMS = ['A', 'B'] as const
const playersOfTeam = (team: Team): [PlayerId, PlayerId] => [`${team}1` as PlayerId, `${team}2` as PlayerId]

function FixForm({ setup, state, flipped, onClose, onSave }: Omit<Props, 'open'>) {
  const { t, lang } = useApp()
  const uid = useId()
  const doubles = setup.format.kind === 'doubles'
  const ds = isDoublesSideout(setup)

  const [raw, setRaw] = useState<Record<Team, string>>({ A: String(state.score.A), B: String(state.score.B) })
  const [serving, setServing] = useState<Team>(state.servingTeam)
  const [num, setNum] = useState<1 | 2>(state.serverNumber === 1 ? 1 : 2)
  const [server, setServer] = useState<PlayerId>(state.server)
  const [starting, setStarting] = useState<Record<Team, PlayerId>>({ ...state.startingServer })

  const score: Record<Team, number> = { A: clampScore(raw.A), B: clampScore(raw.B) }
  // サーバーはサーブ側の選手。チームを替えたら、点数どおりに右に立つ人にする
  const effServer: PlayerId = doubles
    ? teamOf(server) === serving
      ? server
      : rightPlayer(serving, score[serving], starting)
    : singlesPlayer(serving)

  const input: FixInput = {
    score,
    servingTeam: serving,
    serverNumber: ds ? num : null,
    server: effServer,
    startingServer: doubles ? starting : { A: 'A1', B: 'B1' },
  }
  const ev: SetEvent = { type: 'set', ...input, at: 0 }
  const next = applyEvent(state, ev, setup)
  const view = deriveView(state, next, setup, ev)

  const sideOfPlayer = (p: PlayerId): string => {
    const team = teamOf(p)
    const right = rightPlayer(team, score[team], starting)
    return right === p ? t('play.fixRight') : t('play.fixLeft')
  }

  const step = (team: Team, d: number) => setRaw((r) => ({ ...r, [team]: String(clampScore(clampScore(r[team]) + d)) }))

  const changeServing = (team: Team) => {
    setServing(team)
    if (doubles && teamOf(server) !== team) setServer(rightPlayer(team, score[team], starting))
  }

  const save = () => {
    onSave(input)
    onClose()
  }

  const serverLabel = !ds ? t('play.serverLabel') : view.serverNumber === 1 ? t('play.server1Label') : t('play.server2Label')

  return (
    <form
      className="fix"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className="fix-scores">
        {TEAMS.map((team) => {
          const id = `${uid}-score-${team}`
          const label = teamLabel(team, lang)
          return (
            <div key={team} className={`field fix-score fix-score-${team.toLowerCase()}`}>
              <label className="field-label" htmlFor={id}>
                {t('play.fixScore', { team: label })}
              </label>
              <div className="stepper">
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label={t('play.fixDec', { team: label })}
                  disabled={score[team] <= 0}
                  onClick={() => step(team, -1)}
                >
                  <span aria-hidden="true">−</span>
                </button>
                <input
                  id={id}
                  className="input num stepper-input"
                  data-testid={`fix-score-${team}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  step={1}
                  value={raw[team]}
                  onChange={(e) => setRaw((r) => ({ ...r, [team]: e.target.value }))}
                  onBlur={() => setRaw((r) => ({ ...r, [team]: String(clampScore(r[team])) }))}
                />
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label={t('play.fixInc', { team: label })}
                  disabled={score[team] >= 99}
                  onClick={() => step(team, 1)}
                >
                  <span aria-hidden="true">+</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="field">
        <span className="field-label" id={`${uid}-serving`}>
          {t('play.fixServingTeam')}
        </span>
        <div className="seg" role="group" aria-labelledby={`${uid}-serving`}>
          {TEAMS.map((team) => (
            <button key={team} type="button" aria-pressed={serving === team} data-testid={`fix-serving-${team}`} onClick={() => changeServing(team)}>
              {teamLabel(team, lang)}
            </button>
          ))}
        </div>
      </div>

      {ds && (
        <div className="field">
          <span className="field-label" id={`${uid}-num`}>
            {t('play.fixServerNumber')}
          </span>
          <div className="seg" role="group" aria-labelledby={`${uid}-num`}>
            {([1, 2] as const).map((n) => (
              <button key={n} type="button" aria-pressed={num === n} data-testid={`fix-num-${n}`} onClick={() => setNum(n)}>
                {t('play.fixServerNumberN', { n })}
              </button>
            ))}
          </div>
        </div>
      )}

      {doubles && (
        <div className="field">
          <span className="field-label" id={`${uid}-server`}>
            {t('play.fixServer')}
          </span>
          <div className="seg" role="group" aria-labelledby={`${uid}-server`}>
            {playersOfTeam(serving).map((p) => (
              <button key={p} type="button" aria-pressed={effServer === p} data-testid={`fix-server-${p}`} onClick={() => setServer(p)}>
                <span className="fix-name">{displayName(p, setup)}</span>
                <span className="fix-side">{t('play.paren', { x: sideOfPlayer(p) })}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {doubles && (
        <fieldset className="fix-starting">
          <legend className="field-label">{t('play.fixStarting')}</legend>
          {TEAMS.map((team) => (
            <div key={team} className="fix-starting-row">
              <span className={`tag tag-${team.toLowerCase()}`} id={`${uid}-st-${team}`}>
                {team}
              </span>
              <div className="seg" role="group" aria-labelledby={`${uid}-st-${team}`}>
                {playersOfTeam(team).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={starting[team] === p}
                    onClick={() => setStarting((s) => ({ ...s, [team]: p }))}
                  >
                    <span className="fix-name">{displayName(p, setup)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      )}

      <section className="fix-preview" aria-labelledby={`${uid}-preview`}>
        <h3 className="field-label" id={`${uid}-preview`}>
          {t('play.fixPreview')}
        </h3>
        <p className={`fix-call num call-${view.servingTeam.toLowerCase()}`} data-testid="fix-preview-call">
          {view.callText}
        </p>
        <p className="fix-sub small">
          {serverLabel}: <strong>{displayName(view.server, setup)}</strong>
          {t('play.paren', { x: view.serverSide === 'right' ? t('common.fromRight') : t('common.fromLeft') })}
          {' → '}
          {t('play.receiverLabel')}: <strong>{displayName(view.receiver, setup)}</strong>
        </p>
        {next.winner && <p className="fix-ends small">{t('play.fixEnds')}</p>}
        <Court setup={setup} view={view} flipped={flipped} size="sm" testIdPrefix="fix-chip" />
        <p className="note">{t('play.fixNote')}</p>
      </section>

      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn btn-primary" data-testid="fix-save">
          {t('common.save')}
        </button>
      </div>
    </form>
  )
}
