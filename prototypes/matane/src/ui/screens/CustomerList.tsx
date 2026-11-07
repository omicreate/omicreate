/** S6 お客様一覧（4.7）: 検索（前方一致）・並べ替え・フィルタ */
import { useMemo, useState } from 'react'
import {
  compareNames,
  exclusionReasonLabel,
  formatMonthDay,
  formatYearMonthJa,
  nameStartsWith,
  type Customer,
  type DueInfo,
  type ExclusionReason,
} from '../../domain'
import { loadSampleData, SAMPLE_DB } from '../../storage'
import { useApp, useSettings } from '../../state/AppState'
import { useEligibility } from '../../state/derived'
import { navigate, to } from '../../state/router'
import { nowISO } from '../../state/today'
import { Chip, Empty, StatusBadge } from '../components/Basics'
import { ChevronRight } from '../components/Icons'

export type ListFilter = 'all' | 'candidates' | 'confirm' | 'dormant' | 'salon' | 'no_contact' | 'archived' | 'excluded'
export type ListSort = 'due' | 'last' | 'name'

const FILTERS: ReadonlyArray<{ value: ListFilter; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'candidates', label: '声かけ候補' },
  { value: 'confirm', label: '確認待ち' },
  { value: 'dormant', label: '1年以上来ていない' },
  { value: 'salon', label: '所属サロン' },
  { value: 'no_contact', label: '連絡しない' },
  { value: 'archived', label: 'リストから外した' },
  { value: 'excluded', label: '声かけ候補に出していない人' },
]

const SORTS: ReadonlyArray<{ value: ListSort; label: string }> = [
  { value: 'due', label: '目安日が近い順' },
  { value: 'last', label: '最終来店が古い順' },
  { value: 'name', label: '名前順' },
]

function isFilter(x: string | null): x is ListFilter {
  return !!x && FILTERS.some((f) => f.value === x)
}

function isSort(x: string | null): x is ListSort {
  return !!x && SORTS.some((s) => s.value === x)
}

export function CustomerList({ params }: { params: URLSearchParams }) {
  const app = useApp()
  const settings = useSettings()
  const elig = useEligibility()
  const filter: ListFilter = isFilter(params.get('filter')) ? (params.get('filter') as ListFilter) : 'all'
  const sort: ListSort = isSort(params.get('sort')) ? (params.get('sort') as ListSort) : 'due'
  const [q, setQ] = useState('')
  const customers = app.data.customers.filter((c) => !c.deletedAt)

  const excludedReason = useMemo(() => {
    const m = new Map<string, ExclusionReason>()
    for (const e of elig?.excluded ?? []) m.set(e.customer.id, e.reason)
    return m
  }, [elig])

  const rows = useMemo(() => {
    if (!elig) return []
    const cand = new Set(elig.candidates.map((c) => c.customer.id))
    const dueOf = (c: Customer): DueInfo => elig.dueById.get(c.id) ?? { status: 'no_data' }
    const pass = (c: Customer): boolean => {
      const d = dueOf(c)
      switch (filter) {
        case 'all':
          return true
        case 'candidates':
          return cand.has(c.id)
        case 'confirm':
          return d.status === 'confirm'
        case 'dormant':
          return d.status === 'dormant'
        case 'salon':
          return c.stewardship.steward === 'salon'
        case 'no_contact':
          return c.contact.permission === 'no'
        case 'archived':
          return !!c.archived
        case 'excluded':
          return excludedReason.has(c.id)
      }
    }
    const list = customers.filter((c) => pass(c) && (!q.trim() || nameStartsWith(c.nickname, c.kana, q)))
    return list
      .map((c) => ({ c, d: dueOf(c) }))
      .sort((a, b) => {
        if (sort === 'name') return compareNames(a.c, b.c)
        if (sort === 'due') {
          const x = a.d.dueDate ?? '9999-12-31'
          const y = b.d.dueDate ?? '9999-12-31'
          return x === y ? compareNames(a.c, b.c) : x < y ? -1 : 1
        }
        const x = a.d.lastVisit?.date ?? '9999-12-31'
        const y = b.d.lastVisit?.date ?? '9999-12-31'
        return x === y ? compareNames(a.c, b.c) : x < y ? -1 : 1
      })
  }, [elig, customers, filter, sort, q, excludedReason])

  const setParam = (patch: { filter?: ListFilter; sort?: ListSort }) =>
    navigate(to('/customers', { filter: (patch.filter ?? filter) === 'all' ? undefined : (patch.filter ?? filter), sort: (patch.sort ?? sort) === 'due' ? undefined : (patch.sort ?? sort) }), {
      replace: true,
    })

  if (customers.length === 0) {
    return (
      <main className="screen stack" aria-labelledby="list-title">
        <h1 className="title" id="list-title">
          お客様
        </h1>
        <Empty
          actions={
            <>
              <a className="btn btn-primary" href="#/bulk">
                ざっくり登録
              </a>
              <button type="button" className="btn btn-outline" onClick={() => void app.openDb(SAMPLE_DB, (r) => loadSampleData(r, app.today, nowISO()))}>
                サンプルで試す
              </button>
            </>
          }
        >
          まだお客様がいません
        </Empty>
      </main>
    )
  }

  return (
    <main className="screen stack" aria-labelledby="list-title">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h1 className="title" id="list-title">
          お客様<span className="section-count small">（{customers.length}人）</span>
        </h1>
        <a className="btn btn-sm" href="#/bulk">
          ざっくり登録
        </a>
      </div>

      <div className="stack-sm">
        <label className="visually-hidden" htmlFor="list-search">
          呼び名・かなで探す
        </label>
        <input
          id="list-search"
          className="input"
          type="search"
          placeholder="呼び名・かなで探す"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="chips chips-scroll" role="group" aria-label="絞り込み">
          {FILTERS.filter((f) => f.value !== 'excluded' || filter === 'excluded' || excludedReason.size > 0).map((f) => (
            <Chip key={f.value} pressed={filter === f.value} onClick={() => setParam({ filter: f.value })}>
              {f.label}
            </Chip>
          ))}
        </div>
        <div className="field" style={{ maxWidth: 260 }}>
          <label className="visually-hidden" htmlFor="list-sort">
            並べ替え
          </label>
          <select id="list-sort" className="select" value={sort} onChange={(e) => setParam({ sort: e.target.value as ListSort })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="muted">当てはまるお客様はいません</p>
      ) : (
        <ul className="list" aria-label="お客様の一覧">
          {rows.map(({ c, d }) => (
            <li key={c.id}>
              <a className="list-link" href={`#/customer/${encodeURIComponent(c.id)}`}>
                <div className="grow">
                  <div className="candidate-head">
                    <span className="name">{c.nickname}</span>
                    <StatusBadge status={d.status} />
                    {c.stewardship.steward === 'salon' && <span className="badge badge-salon">所属サロン</span>}
                  </div>
                  <p className="meta">
                    {d.lastVisit
                      ? `最終来店 ${d.lastVisit.dateApprox ? `${formatYearMonthJa(d.lastVisit.date)}ごろ` : formatMonthDay(d.lastVisit.date)}`
                      : '最終来店を入れると目安が出ます'}
                    {d.dueDate && d.status !== 'archived' ? `・目安 ${formatMonthDay(d.dueDate)}` : ''}
                  </p>
                  {filter === 'excluded' && excludedReason.has(c.id) && (
                    <p className="meta">{exclusionReasonLabel(excludedReason.get(c.id)!, settings)}</p>
                  )}
                </div>
                <ChevronRight />
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
