/**
 * S3 閉店後のまとめ記録（4.4）。その日の予約者と記録済みの人を並べ、来た／来なかった／未定をまとめて付ける。
 * 保存後10秒間はまとめて取り消せる。失敗した行は画面に残す。
 */
import { useMemo, useState } from 'react'
import {
  addDays,
  applyVisitToCustomer,
  batchTargets,
  createVisit,
  effectiveOpenBooking,
  formatDateWithWeekday,
  markNotVisited,
  withoutBooking,
  menuText,
  validateVisitInput,
  VALIDATION_MESSAGES,
  type Customer,
  type NextPlan,
  type Visit,
} from '../../domain'
import { useApp } from '../../state/AppState'
import { customerById, recentCustomers, visitsOf } from '../../state/derived'
import { useFeedback } from '../../state/feedback'
import { nowISO } from '../../state/today'
import { useDraft } from '../../state/useDraft'
import { Empty, Segmented, TopBar } from '../components/Basics'
import { CustomerPicker, MenuChips, NextChips } from '../components/Pickers'
import { Sheet } from '../components/Sheet'

type RowState = 'came' | 'no' | 'undecided'

interface BatchRow {
  state: RowState
  menuIds: string[]
  next: NextPlan
}

interface BatchDraft {
  which: 'today' | 'yesterday'
  rows: Record<string, BatchRow>
  added: string[]
}

function restoreBatch(d: unknown): BatchDraft | null {
  if (!d || typeof d !== 'object') return null
  const x = d as Partial<BatchDraft>
  if ((x.which !== 'today' && x.which !== 'yesterday') || typeof x.rows !== 'object' || !Array.isArray(x.added)) return null
  return { which: x.which, rows: x.rows ?? {}, added: x.added }
}

export function Batch() {
  const app = useApp()
  const { offerUndo, toast } = useFeedback()
  const { customers, visits, menus } = app.data
  const today = app.today
  const draft = useDraft<BatchDraft>(`batch:${today}`, () => ({ which: 'today', rows: {}, added: [] }), restoreBatch)
  const d = draft.value
  const date = d.which === 'today' ? today : addDays(today, -1)
  const [picking, setPicking] = useState(false)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const targets = useMemo(() => batchTargets(customers, visits, date), [customers, visits, date])
  const targetIds = new Set(targets.map((t) => t.customer.id))
  const addedRows = d.added
    .filter((id) => !targetIds.has(id))
    .map((id) => customerById(customers, id))
    .filter((c): c is NonNullable<typeof c> => !!c)
  const recent = useMemo(() => recentCustomers(customers, visits, 5), [customers, visits])

  const prevOf = (cid: string): Visit | undefined => {
    const own = visitsOf(visits, cid, today).filter((v) => v.date < date)
    return own[own.length - 1]
  }

  const rowOf = (cid: string, added: boolean): BatchRow =>
    d.rows[cid] ?? { state: added ? 'came' : 'undecided', menuIds: [...(prevOf(cid)?.menuIds ?? [])], next: { kind: 'none' } }

  const setRow = (cid: string, added: boolean, patch: Partial<BatchRow>) =>
    draft.set((p) => ({ ...p, rows: { ...p.rows, [cid]: { ...(p.rows[cid] ?? rowOf(cid, added)), ...patch } } }))

  const pending = [
    ...targets.filter((t) => !t.recorded).map((t) => ({ customer: t.customer, added: false })),
    ...addedRows.map((c) => ({ customer: c, added: true })),
  ]
  const recorded = targets.filter((t) => t.recorded)

  const saveAll = async () => {
    const repo = app.repo
    if (!repo) return
    const errs: Record<string, string> = {}
    for (const p of pending) {
      const r = rowOf(p.customer.id, p.added)
      if (r.state !== 'came') continue
      const e = validateVisitInput({ date, menuIds: r.menuIds, next: r.next }, today)
      if (r.next.kind === 'booked' && !r.next.date) e.push('予約日を入れてください')
      if (e.length) errs[p.customer.id] = e[0]
    }
    setRowErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    const now = nowISO()
    const created: string[] = []
    const changed: Visit[] = []
    /** 保存で書き換えた顧客の、元の状態（取り消しで戻す） */
    const changedCustomers: Customer[] = []
    let notVisitedCount = 0
    const unarchived: Customer[] = []
    const failedIds: string[] = []
    const done: string[] = []
    for (const p of pending) {
      const cid = p.customer.id
      const r = rowOf(cid, p.added)
      try {
        if (r.state === 'came') {
          const v = createVisit({ customerId: cid, date, menuIds: r.menuIds, next: r.next, source: 'batch', now })
          // 来店を記録したら、リストから外していた客は自動で戻す（4.3）。あとから入れた予約は、この来店で済んだものとして消す
          const applied = applyVisitToCustomer(p.customer, { today, now, visitDate: date })
          await repo.saveVisitWithCustomer(v, applied.changed ? applied.customer : undefined)
          created.push(v.id)
          if (applied.changed) changedCustomers.push(p.customer)
          if (applied.unarchived) unarchived.push(p.customer)
          done.push(cid)
        } else if (r.state === 'no') {
          const booking = effectiveOpenBooking(p.customer, visitsOf(visits, cid, date), date)
          if (booking && booking.date === date) {
            if (booking.source === 'visit') {
              await repo.putVisit(markNotVisited(booking.visit, now))
              changed.push(booking.visit)
            } else {
              await repo.putCustomer(withoutBooking(p.customer, now))
              changedCustomers.push(p.customer)
            }
            notVisitedCount++
          }
          done.push(cid)
        }
      } catch {
        failedIds.push(cid)
      }
    }
    if (created.length) await repo.incrementCounter('visitsSaved', created.length, today).catch(() => undefined)
    await app.reload()
    setFailed(failedIds)
    draft.set((p) => {
      const rows = { ...p.rows }
      for (const id of done) delete rows[id]
      return { ...p, rows, added: p.added.filter((id) => !done.includes(id)) }
    })
    if (failedIds.length === 0) await draft.clear()
    setBusy(false)
    const n = created.length
    const m = notVisitedCount
    if (unarchived.length > 0) toast(`${unarchived.length}人をリストに戻しました`)
    if (n + m > 0) {
      offerUndo({
        message: n > 0 ? `${n}人を記録しました` : `${m}人を「来なかった」にしました`,
        undo: async () => {
          await repo.purgeVisits(created)
          for (const v of changed) await repo.putVisit(v)
          if (changedCustomers.length) await repo.putCustomers(changedCustomers)
        },
      })
    }
  }

  return (
    <main className="screen stack" aria-labelledby="batch-title">
      <div className="stack-xs">
        <TopBar back="#/" backLabel="ホーム" />
        <h1 className="title" id="batch-title">
          閉店後のまとめ記録
        </h1>
      </div>

      <Segmented<'today' | 'yesterday'>
        label="日付"
        options={[
          { value: 'today', label: '今日' },
          { value: 'yesterday', label: '昨日の分' },
        ]}
        value={d.which}
        onChange={(w) => draft.set({ which: w, rows: {}, added: [] })}
      />
      <p className="metric-line">{formatDateWithWeekday(date)}</p>

      {pending.length === 0 && recorded.length === 0 ? (
        <Empty
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setPicking(true)}>
              ＋人を足す
            </button>
          }
        >
          この日の予約は入っていません
        </Empty>
      ) : (
        <>
          {pending.map(({ customer, added }) => {
            const r = rowOf(customer.id, added)
            const prev = prevOf(customer.id)
            return (
              <section key={customer.id} className="card stack-sm" aria-label={customer.nickname}>
                <div>
                  <p className="name">{customer.nickname}</p>
                  {prev && (
                    <p className="meta">
                      前回 {prev.date}　{menuText(prev.menuIds, menus) || 'メニューなし'}
                    </p>
                  )}
                  {failed.includes(customer.id) && (
                    <p className="error" role="alert">
                      保存できませんでした
                    </p>
                  )}
                </div>
                <Segmented<RowState>
                  label={`${customer.nickname}さん`}
                  labelHidden
                  options={[
                    { value: 'came', label: '来た' },
                    { value: 'no', label: '来なかった' },
                    { value: 'undecided', label: '未定' },
                  ]}
                  value={r.state}
                  onChange={(s) => setRow(customer.id, added, { state: s })}
                />
                {r.state === 'came' && (
                  <>
                    <MenuChips
                      menus={menus}
                      selected={r.menuIds}
                      previous={prev?.menuIds}
                      onChange={(ids) => setRow(customer.id, added, { menuIds: ids })}
                      error={rowErrors[customer.id] === VALIDATION_MESSAGES.menuRequired ? rowErrors[customer.id] : null}
                    />
                    <NextChips
                      value={r.next}
                      visitDate={date}
                      onChange={(n) => setRow(customer.id, added, { next: n })}
                      error={rowErrors[customer.id] && rowErrors[customer.id] !== VALIDATION_MESSAGES.menuRequired ? rowErrors[customer.id] : null}
                    />
                  </>
                )}
              </section>
            )
          })}

          {recorded.length > 0 && (
            <section aria-labelledby="recorded-title">
              <h2 className="label" id="recorded-title" style={{ marginBottom: 8 }}>
                記録済み
              </h2>
              <ul className="list">
                {recorded.map((t) => (
                  <li key={t.customer.id} className="list-item" style={{ minHeight: 52 }}>
                    <span className="grow">{t.customer.nickname}</span>
                    <span className="meta">{t.todayVisit ? menuText(t.todayVisit.menuIds, menus) : ''}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button type="button" className="btn btn-outline btn-block" onClick={() => setPicking(true)}>
            ＋人を足す
          </button>
          {pending.length > 0 && (
            <button type="button" className="btn btn-primary btn-block" style={{ minHeight: 56 }} disabled={busy} onClick={() => void saveAll()}>
              まとめて保存
            </button>
          )}
        </>
      )}

      {picking && (
        <Sheet title="人を足す" onClose={() => setPicking(false)}>
          <CustomerPicker
            customers={customers.filter((c) => !targetIds.has(c.id) && !d.added.includes(c.id))}
            recent={recent.filter((c) => !targetIds.has(c.id) && !d.added.includes(c.id))}
            autoFocus
            onPick={(c) => {
              draft.set((p) => ({ ...p, added: [...p.added, c.id] }))
              setPicking(false)
            }}
          />
        </Sheet>
      )}
    </main>
  )
}
