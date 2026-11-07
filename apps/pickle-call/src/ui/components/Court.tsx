// コート図（縦長・ネットは横）。線は SVG、選手のチップは HTML を重ねる（名前の省略や読み上げが扱いやすいため）。
// 未反転では A チームが下。チップには data-testid="chip-<ID>" と data-quadrant を付ける（E2E で位置を確かめる）。
import { toQuadrant } from '../../domain/court'
import { teamOf } from '../../domain/engine'
import { displayName } from '../../domain/speech-text'
import type { PlayerId, Quadrant, Setup, Team, View } from '../../domain/types'
import { playersOf } from '../../domain/view'
import { useApp } from '../store'
import './court.css'

/** 各区画のチップの中心（コート全体に対する％）。サービスコートの奥寄りに置く */
const CENTER: Record<Quadrant, { x: number; y: number }> = {
  TL: { x: 25, y: 17 },
  TR: { x: 75, y: 17 },
  BL: { x: 25, y: 83 },
  BR: { x: 75, y: 83 },
}

interface Props {
  setup: Setup
  view: View
  flipped?: boolean
  size?: 'md' | 'sm'
  /** サーブとレシーブの印と矢印を出す */
  showRoles?: boolean
  /** チップの data-testid の頭（同じ画面に2つ目のコート図を置くとき、名前が重ならないように変える） */
  testIdPrefix?: string
  /** いまのスターティングサーバー（「スコアを直す」で替えたときはこちら）。省略すると設定のもの */
  startingServer?: Record<Team, PlayerId>
}

export function Court({ setup, view, flipped = false, size = 'md', showRoles = true, testIdPrefix = 'chip', startingServer }: Props) {
  const { t } = useApp()
  const ss = startingServer ?? setup.startingServer
  const players = playersOf(setup)
  const top = flipped ? 'A' : 'B'
  const bottom = flipped ? 'B' : 'A'
  const quadOf = (p: PlayerId): Quadrant => toQuadrant(teamOf(p), view.positions[p] ?? 'right', flipped)
  const sq = quadOf(view.server)
  const rq = quadOf(view.receiver)
  const from = CENTER[sq]
  const to = CENTER[rq]
  const servingColor = view.servingTeam === 'A' ? 'var(--a)' : 'var(--b)'

  return (
    <figure
      className={`court court-${size}`}
      aria-label={t('court.label', { top: t('common.team', { team: top }), bottom: t('common.team', { team: bottom }) })}
    >
      <svg className="court-lines" viewBox="0 0 200 440" preserveAspectRatio="none" aria-hidden="true">
        <rect x="1" y="1" width="198" height="438" rx="2" className="court-surface" />
        <rect x="1" y="150" width="198" height="140" className="court-kitchen" />
        <line x1="100" y1="1" x2="100" y2="150" className="court-line" />
        <line x1="100" y1="290" x2="100" y2="439" className="court-line" />
        <line x1="1" y1="150" x2="199" y2="150" className="court-line" />
        <line x1="1" y1="290" x2="199" y2="290" className="court-line" />
        <line x1="-4" y1="220" x2="204" y2="220" className="court-net" />
        {showRoles && (
          <line
            x1={from.x * 2}
            y1={from.y * 4.4 + (from.y < 50 ? 34 : -34)}
            x2={to.x * 2}
            y2={to.y * 4.4 + (to.y < 50 ? 34 : -34)}
            className="court-arrow"
            style={{ stroke: servingColor }}
            markerEnd="url(#court-arrowhead)"
          />
        )}
        <defs>
          <marker id="court-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: servingColor }} />
          </marker>
        </defs>
      </svg>
      <span className="court-team court-team-top" aria-hidden="true">
        {t('common.team', { team: top })}
      </span>
      <span className="court-team court-team-bottom" aria-hidden="true">
        {t('common.team', { team: bottom })}
      </span>
      {players.map((p) => {
        const q = quadOf(p)
        const c = CENTER[q]
        const team = teamOf(p)
        const role = !showRoles ? 'none' : p === view.server ? 'server' : p === view.receiver ? 'receiver' : 'none'
        const isStarting = setup.format.kind === 'doubles' && ss[team] === p
        const side = (view.positions[p] ?? 'right') === 'right' ? t('common.right') : t('common.left')
        const name = displayName(p, setup)
        return (
          <div
            key={p}
            className={`chip chip-${team.toLowerCase()} chip-${role}`}
            data-testid={`${testIdPrefix}-${p}`}
            data-quadrant={q}
            data-role={role}
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
          >
            <span className="chip-name" title={name}>
              {name}
            </span>
            {/* 支援技術向け: どのチームのどちら側に立つか（図の位置は読み上げられないため） */}
            <span className="visually-hidden">
              {t('common.team', { team })} {side}
            </span>
            <span className="chip-meta">
              {isStarting && (
                <>
                  <span className="chip-s" aria-hidden="true" title={t('common.startingServer')}>
                    {t('common.startingServerMark')}
                  </span>
                  <span className="visually-hidden">{t('common.startingServer')}</span>
                </>
              )}
              {role === 'server' && <span className="chip-role">{t('common.serve')}</span>}
              {role === 'receiver' && <span className="chip-role">{t('common.receive')}</span>}
            </span>
          </div>
        )
      })}
    </figure>
  )
}
