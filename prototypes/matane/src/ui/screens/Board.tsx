/**
 * S7 わたしの再来ボード（4.8）。数字は3つだけで、先月の自分とだけ比べる。
 * 円・率・グラフ・業界平均・予測は出さない。
 */
import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  board,
  boardCopyText,
  compareNames,
  MESSAGES,
  promiseText,
  type Customer,
  type ID,
} from '../../domain'
import { useApp, useSettings } from '../../state/AppState'
import { copyText } from '../../state/platform'
import { useFeedback } from '../../state/feedback'
import { Empty } from '../components/Basics'

export function Board() {
  const app = useApp()
  const settings = useSettings()
  const { toast } = useFeedback()
  const { customers, visits, contacts, menus, counters } = app.data
  const today = app.today
  const b = useMemo(() => board({ customers, visits, contacts, menus, settings, today }), [customers, visits, contacts, menus, settings, today])
  const [fallbackText, setFallbackText] = useState<string | null>(null)
  const fallbackRef = useRef<HTMLTextAreaElement>(null)
  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const names = (ids: readonly ID[]) =>
    ids
      .map((id) => byId.get(id))
      .filter((c): c is Customer => !!c)
      .sort(compareNames)
      .map((c) => c.nickname)

  const copy = async () => {
    if (!counters) return
    const text = boardCopyText({ board: b, visits, counters, settings, today })
    if (await copyText(text)) {
      setFallbackText(null)
      toast('数字をコピーしました')
    } else {
      setFallbackText(text)
      window.setTimeout(() => {
        fallbackRef.current?.focus()
        fallbackRef.current?.select()
      }, 0)
    }
  }

  return (
    <main className="screen stack" aria-labelledby="board-title">
      <h1 className="title" id="board-title">
        わたしの再来ボード
      </h1>

      {b.empty ? (
        <Empty>来店を記録すると、ここに数字が出ます</Empty>
      ) : (
        <>
          <Metric label="稼働顧客数" detail={b.active ? names(b.active.nowIds) : null}>
            {b.active ? (
              <>
                <p className="metric-num">
                  {b.active.now}
                  <small>人</small>
                </p>
                <p className="metric-sub">最終来店が1年以内</p>
                <p className="metric-sub">先月末 {b.active.lastMonthEnd}人</p>
              </>
            ) : (
              <p className="muted">計算できませんでした</p>
            )}
          </Metric>

          <Metric
            label="次回の約束あり"
            detail={b.promise ? names(b.promise.thisMonth.customerIds) : null}
            detailLabel="今月記録した人"
          >
            {b.promise ? (
              <>
                {b.promise.thisMonth.total === 0 ? (
                  <p className="metric-line">今月の記録はまだありません</p>
                ) : (
                  <>
                    <p className="metric-num">
                      <small>今月 </small>
                      {b.promise.thisMonth.total}
                      <small>件中</small>
                      {b.promise.thisMonth.kept}
                      <small>件</small>
                    </p>
                    <p className="metric-sub">
                      {promiseText(b.promise.thisMonth).replace(/^\d+件中\d+件/, '') || '（予約・目安なし）'}
                    </p>
                  </>
                )}
                <p className="metric-sub">先月 {promiseText(b.promise.lastMonth)}</p>
              </>
            ) : (
              <p className="muted">計算できませんでした</p>
            )}
          </Metric>

          <Metric
            label={`声かけと戻り（直近${settings.compareWindowDays}日）`}
            detail={
              b.koekake
                ? [
                    ...names(b.koekake.contacted.customerIds).map((n) => `声かけ: ${n}`),
                    ...names(b.koekake.notContacted.customerIds).map((n) => `声かけなし: ${n}`),
                  ]
                : null
            }
          >
            {b.koekake ? (
              <div className="stack-xs">
                <p className="metric-line">
                  声かけした人 <strong>{b.koekake.contacted.count}人</strong> → その後来店 <strong>{b.koekake.contacted.returned}人</strong>
                </p>
                <p className="metric-line">
                  声かけしなかったご無沙汰の人 <strong>{b.koekake.notContacted.count}人</strong> → その後来店{' '}
                  <strong>{b.koekake.notContacted.returned}人</strong>
                </p>
                <p className="hint">{MESSAGES.boardNotProof}</p>
              </div>
            ) : (
              <p className="muted">計算できませんでした</p>
            )}
          </Metric>
        </>
      )}

      <p className="muted small">{MESSAGES.boardCompare}</p>

      <div className="stack-sm">
        <button type="button" className="btn btn-outline btn-block" onClick={() => void copy()} disabled={!counters}>
          数字をコピー（名前は含まない）
        </button>
        <p className="hint">作り手に送るかどうかは、あなたが決めます。アプリから自動で送ることはありません。</p>
        {fallbackText && (
          <div className="field">
            <label className="field-label" htmlFor="board-copy">
              長押しでコピーしてください
            </label>
            <textarea id="board-copy" ref={fallbackRef} className="textarea" rows={8} readOnly value={fallbackText} />
          </div>
        )}
      </div>
    </main>
  )
}

function Metric({
  label,
  children,
  detail,
  detailLabel = '内訳',
}: {
  label: string
  children: ReactNode
  detail: string[] | null
  detailLabel?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="card metric" aria-label={label}>
      <h2 className="label">{label}</h2>
      <div style={{ marginTop: 8 }}>{children}</div>
      {detail && (
        <button type="button" className="toggle-more small" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? '閉じる' : `${detailLabel}を見る`}
        </button>
      )}
      {open && detail && (
        <div className="memo-box small" style={{ marginTop: 4 }}>
          {detail.length === 0 ? <p className="muted">いません</p> : <p>{detail.join('、')}</p>}
          <p className="faint xs" style={{ marginTop: 4 }}>
            名前はこの端末の中だけに表示しています
          </p>
        </div>
      )}
    </section>
  )
}
