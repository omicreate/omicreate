// 大きなコール表示（例: 4-2-1）。aria-live の領域に、読み上げと同じ文を見えない形で入れる。
// 大きな数字は読み上げ文と重複するので支援技術からは隠し、文の方を読ませる（TTS がなくても聞ける）。
import type { Team } from '../../domain/types'

interface Props {
  callText: string
  /** 読み上げと同じ文 */
  spoken: string
  servingTeam: Team
  done?: boolean
}

export function CallDisplay({ callText, spoken, servingTeam, done = false }: Props) {
  return (
    <div className="call-block" aria-live="polite" aria-atomic="true">
      <p
        className={`call num call-${servingTeam.toLowerCase()}${done ? ' call-done' : ''}`}
        data-testid="call"
        data-serving={servingTeam}
        aria-hidden="true"
      >
        {callText}
      </p>
      <p className="visually-hidden" data-testid="call-spoken">
        {spoken}
      </p>
    </div>
  )
}
