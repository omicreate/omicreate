// 「Aの勝ち」「Bの勝ち」の大きなボタン（下部・親指の届く位置・高さ96px以上）。
// コート図の上下を入れ替えても、A は左・B は右のまま（チーム名と色と名前で見分ける）。
// iOS では読み上げをクリックの処理の中で同期的に始める必要があるので、onClick からそのまま呼ぶ。
import { cleanName, hasName } from '../../domain/speech-text'
import type { PlayerId, Setup, Team } from '../../domain/types'
import { useApp } from '../store'

interface Props {
  setup: Setup
  disabled?: boolean
  onRally: (team: Team) => void
}

function members(team: Team, setup: Setup, lang: 'ja' | 'en'): string {
  const ps: PlayerId[] = setup.format.kind === 'doubles' ? [`${team}1` as PlayerId, `${team}2` as PlayerId] : [`${team}1` as PlayerId]
  const named = ps.filter((p) => hasName(p, setup)).map((p) => cleanName(setup.names[p]))
  return named.join(lang === 'ja' ? '・' : ' & ')
}

export function RallyButtons({ setup, disabled = false, onRally }: Props) {
  const { t, lang } = useApp()
  return (
    <div className="rally">
      {(['A', 'B'] as const).map((team) => {
        const names = members(team, setup, lang)
        return (
          <button
            key={team}
            type="button"
            className={`rally-btn rally-${team.toLowerCase()}`}
            data-testid={`rally-${team}`}
            disabled={disabled}
            onClick={() => onRally(team)}
          >
            <span className="rally-label">{t('play.won', { team })}</span>
            {names && <span className="rally-names">{names}</span>}
          </button>
        )
      })}
    </div>
  )
}
