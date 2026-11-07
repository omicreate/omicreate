/** ［今回は見送る］の3択（4.5）: 2週間／次の周期まで／連絡しないにする */
import type { SkipOption } from '../../state/actions'
import { Sheet } from '../components/Sheet'

export function SkipSheet({
  onClose,
  onPick,
  busy,
}: {
  onClose: () => void
  onPick: (o: SkipOption) => void | Promise<void>
  /** 保存中は押せない（二重に数えないように） */
  busy?: boolean
}) {
  return (
    <Sheet title="今回は見送る" onClose={onClose}>
      <div className="stack-sm">
        <button type="button" className="btn btn-block" disabled={busy} onClick={() => void onPick('two_weeks')}>
          2週間
        </button>
        <button type="button" className="btn btn-block" disabled={busy} onClick={() => void onPick('next_cycle')}>
          次の周期まで
        </button>
        <button type="button" className="btn btn-block btn-outline" disabled={busy} onClick={() => void onPick('no_contact')}>
          連絡しないにする
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
          やめる
        </button>
      </div>
    </Sheet>
  )
}
