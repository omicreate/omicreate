/**
 * S6 ざっくり登録（4.7）: 呼び名・最終来店・主なメニューだけで手早く登録する。
 * 共通設定のデータの管理者は必須。呼び名が入った行から順に自動保存し、その場でホームの候補に反映する。
 */
import { useEffect, useRef, useState } from 'react'
import {
  createBulkRecords,
  createVisit,
  LAST_VISIT_ERROR,
  MESSAGES,
  newId,
  parseLastVisitInput,
  validateNickname,
  type AcquisitionChannel,
  type DataSteward,
  type Visit,
} from '../../domain'
import { useApp } from '../../state/AppState'
import { useFeedback } from '../../state/feedback'
import { navigate } from '../../state/router'
import { nowISO } from '../../state/today'
import { useDraft } from '../../state/useDraft'
import { TopBar } from '../components/Basics'
import { applyChannel, MenuChips, StewardFields } from '../components/Pickers'

interface BulkRow {
  key: string
  nickname: string
  lastVisit: string
  menuIds: string[]
  override: boolean
  steward?: DataSteward
  channel?: AcquisitionChannel
  stewardAuto?: boolean
  customerId?: string
  visitId?: string
}

interface BulkDraft {
  steward?: DataSteward
  channel: AcquisitionChannel
  stewardAuto?: boolean
  rows: BulkRow[]
}

function emptyRow(): BulkRow {
  return { key: newId(), nickname: '', lastVisit: '', menuIds: [], override: false }
}

function restoreBulk(d: unknown): BulkDraft | null {
  if (!d || typeof d !== 'object') return null
  const x = d as Partial<BulkDraft>
  if (!Array.isArray(x.rows) || typeof x.channel !== 'string') return null
  return { steward: x.steward, channel: x.channel, stewardAuto: x.stewardAuto, rows: x.rows.length ? x.rows : [emptyRow()] }
}

const SAVE_DELAY = 300
export const STEWARD_REQUIRED = 'データの管理者を選んでください'

export function BulkRegister() {
  const app = useApp()
  const { toast } = useFeedback()
  const draft = useDraft<BulkDraft>(
    'bulk',
    () => ({ channel: 'unknown', rows: [emptyRow(), emptyRow(), emptyRow()] }),
    (data) => {
      const x = restoreBulk(data)
      if (!x) return null
      // 下書きのあとに消した顧客の行は戻さない（作り直さないように。7.3・AC-14）
      const rows = x.rows.filter((r) => !r.customerId || app.data.customers.some((c) => c.id === r.customerId))
      return { ...x, rows: rows.length ? rows : [emptyRow()] }
    },
  )
  const d = draft.value
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const savedSig = useRef(new Map<string, string>())
  const timers = useRef(new Map<string, number>())
  /** 行ごとの保存の列（同じ行の保存を重ねない。重なると同じ顧客が2人できる） */
  const chains = useRef(new Map<string, Promise<unknown>>())
  /** 保存してできた顧客・来店の id（下書きへの反映より先に、すぐ分かるように） */
  const rowIds = useRef(new Map<string, { customerId?: string; visitId?: string }>())
  /** 消された顧客の行（下書きから外した） */
  const dropped = useRef(new Set<string>())
  const [saveError, setSaveError] = useState<string | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const finishingRef = useRef(false)
  const appRef = useRef(app)
  appRef.current = app
  const draftRef = useRef(draft)
  draftRef.current = draft

  const setRow = (key: string, patch: Partial<BulkRow>) =>
    draft.set((p) => ({ ...p, rows: p.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }))

  const effective = (r: BulkRow, common: BulkDraft) => ({
    steward: r.override ? r.steward : common.steward,
    channel: (r.override ? r.channel : undefined) ?? common.channel,
  })

  const idsOf = (r: BulkRow) => rowIds.current.get(r.key) ?? { customerId: r.customerId, visitId: r.visitId }

  const sigOf = (r: BulkRow, common: BulkDraft) => {
    const e = effective(r, common)
    return JSON.stringify([r.nickname.trim(), r.lastVisit.trim(), [...r.menuIds].sort(), e.steward, e.channel])
  }

  /** 保存できない理由（呼び名が入っているのに保存できない行。空の行は null） */
  const problemOf = (r: BulkRow, common: BulkDraft): string | null => {
    if (!r.nickname.trim()) return null
    const nk = validateNickname(r.nickname, appRef.current.data.customers, idsOf(r).customerId)
    if (nk.error) return nk.error
    if (!effective(r, common).steward) return STEWARD_REQUIRED
    return null
  }

  const saveable = (r: BulkRow, common: BulkDraft) => !!r.nickname.trim() && problemOf(r, common) === null

  const dropRow = (key: string) => {
    dropped.current.add(key)
    rowIds.current.delete(key)
    savedSig.current.delete(key)
    draftRef.current.set((p) => {
      const rows = p.rows.filter((x) => x.key !== key)
      return { ...p, rows: rows.length ? rows : [emptyRow()] }
    })
  }

  type RowResult = 'saved' | 'empty' | 'unsaveable' | 'failed' | 'deleted'

  const saveRowNow = async (key: string): Promise<RowResult> => {
    if (dropped.current.has(key)) return 'deleted'
    const common = draftRef.current.value
    const r = common.rows.find((x) => x.key === key)
    if (!r || !r.nickname.trim()) return 'empty'
    if (!saveable(r, common)) return 'unsaveable'
    const sig = sigOf(r, common)
    const ids = idsOf(r)
    if (ids.customerId && savedSig.current.get(key) === sig) return 'saved'
    const a = appRef.current
    const repo = a.repo
    if (!repo) return 'failed'
    const { steward, channel } = effective(r, common)
    const today = a.today
    const now = nowISO()
    try {
      // 今の顧客は保存層に聞く（画面の読み直しを待たずに、確かに分かるように）
      const existing = ids.customerId ? await repo.getCustomer(ids.customerId) : undefined
      if (ids.customerId && (!existing || existing.deletedAt)) {
        // 下書きのあとに消された顧客（顧客カードの削除・所属サロンの顧客のまとめて削除）。作り直さない
        dropRow(key)
        return 'deleted'
      }
      let next: { customerId: string; visitId?: string }
      if (!existing) {
        const res = createBulkRecords({
          nickname: r.nickname,
          lastVisitText: r.lastVisit,
          menuIds: r.menuIds,
          steward: steward!,
          channel,
          today,
          now,
        })
        await a.mutate((rp) => rp.saveRecords({ customers: [res.customer], visits: res.visit ? [res.visit] : [] }))
        next = { customerId: res.customer.id, visitId: res.visit?.id }
      } else {
        const parse = parseLastVisitInput(r.lastVisit, today)
        const changedSteward = existing.stewardship.steward !== steward || existing.stewardship.channel !== channel
        const customer = {
          ...existing,
          nickname: r.nickname.trim(),
          stewardship: changedSteward ? { steward: steward!, channel, decidedOn: today } : existing.stewardship,
          updatedAt: now,
        }
        const oldVisit = ids.visitId ? await repo.getVisit(ids.visitId) : undefined
        let visit: Visit | undefined
        if (parse.kind === 'date') {
          visit = oldVisit
            ? {
                ...oldVisit,
                date: parse.date,
                menuIds: [...r.menuIds],
                updatedAt: now,
                ...(parse.approx ? { dateApprox: 'month' as const } : {}),
              }
            : createVisit({
                customerId: existing.id,
                date: parse.date,
                dateApprox: parse.approx ? 'month' : undefined,
                menuIds: r.menuIds,
                next: { kind: 'none' },
                source: 'bulk',
                now,
              })
          if (!parse.approx && visit.dateApprox) {
            const copy = { ...visit }
            delete copy.dateApprox
            visit = copy
          }
        }
        await a.mutate(async (rp) => {
          await rp.saveRecords({ customers: [customer], visits: visit ? [visit] : [] })
          if (!visit && oldVisit) await rp.purgeVisit(oldVisit.id)
        })
        next = { customerId: existing.id, visitId: visit?.id }
      }
      rowIds.current.set(key, next)
      savedSig.current.set(key, sig)
      draftRef.current.set((p) => ({ ...p, rows: p.rows.map((x) => (x.key === key ? { ...x, ...next } : x)) }))
      setSaveError(null)
      return 'saved'
    } catch {
      setSaveError(MESSAGES.saveFailed)
      return 'failed'
    }
  }

  /** 行を保存する（同じ行の保存が終わるのを待ってから） */
  const saveRow = (key: string): Promise<RowResult> => {
    const prev = chains.current.get(key) ?? Promise.resolve()
    const run = prev.then(
      () => saveRowNow(key),
      () => saveRowNow(key),
    )
    chains.current.set(key, run.catch(() => undefined))
    return run
  }

  // 入力が止まってから0.3秒で、変わった行を順に保存する
  useEffect(() => {
    if (!draft.ready || finishingRef.current) return
    for (const r of d.rows) {
      if (!saveable(r, d)) continue
      if (savedSig.current.get(r.key) === sigOf(r, d)) continue
      const old = timers.current.get(r.key)
      if (old) window.clearTimeout(old)
      timers.current.set(
        r.key,
        window.setTimeout(() => {
          timers.current.delete(r.key)
          void saveRow(r.key)
        }, SAVE_DELAY),
      )
    }
  })

  useEffect(
    () => () => {
      for (const t of timers.current.values()) window.clearTimeout(t)
    },
    [],
  )

  const addRow = () => {
    const row = emptyRow()
    draft.set((p) => ({ ...p, rows: [...p.rows, row] }))
    return row.key
  }

  const focusKey = (k: string) => {
    window.setTimeout(() => inputs.current.get(k)?.focus(), 0)
  }

  const onEnter = (rowKey: string, field: 'n' | 'l') => {
    if (field === 'n') {
      focusKey(`${rowKey}:l`)
      return
    }
    const idx = d.rows.findIndex((r) => r.key === rowKey)
    const nextRow = d.rows[idx + 1]
    focusKey(`${nextRow ? nextRow.key : addRow()}:n`)
  }

  const savedCount = d.rows.filter((r) => idsOf(r).customerId).length
  const needSteward = !d.steward && d.rows.some((r) => r.nickname.trim() && !r.override)

  /**
   * ［○人を登録してホームへ］: 自動保存の待ちを止め、全行を順に保存してからホームへ。
   * 呼び名が入っているのに保存できない行（管理者が未選択・呼び名が21文字以上）や保存に失敗した行があれば、
   * 下書きを残したまま移らず、理由を出す（入力が黙って消えないように。4.7・6.1）
   */
  const finish = async () => {
    if (finishingRef.current) return
    finishingRef.current = true
    setFinishing(true)
    setFinishError(null)
    try {
      for (const t of timers.current.values()) window.clearTimeout(t)
      timers.current.clear()
      const rows = draftRef.current.value.rows
      const results = new Map<string, RowResult>()
      for (const r of rows) results.set(r.key, await saveRow(r.key))
      const common = draftRef.current.value
      const problems: string[] = []
      let firstProblem: string | null = null
      rows.forEach((r, i) => {
        const res = results.get(r.key)
        if (res !== 'unsaveable' && res !== 'failed') return
        const why = res === 'failed' ? '保存できませんでした' : (problemOf(r, common) ?? '保存できませんでした')
        problems.push(`${i + 1}人目: ${why}`)
        firstProblem ??= r.key
      })
      if (problems.length > 0) {
        setFinishError(`まだ保存していない行があります（${problems.join('、')}）`)
        const el = firstProblem ? document.getElementById(`bulk-${firstProblem}-n`)?.closest('li') : null
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' })
        return
      }
      const ids = new Set<string>()
      for (const r of rows) {
        if (dropped.current.has(r.key)) continue
        const c = idsOf(r).customerId
        if (c) ids.add(c)
      }
      await draft.clear()
      if (ids.size > 0) toast(`${ids.size}人を登録しました`)
      navigate('#/')
    } finally {
      finishingRef.current = false
      setFinishing(false)
    }
  }

  return (
    <main className="screen stack" aria-labelledby="bulk-title">
      <div className="stack-xs">
        <TopBar back="#/customers" backLabel="お客様" />
        <h1 className="title" id="bulk-title">
          ざっくり登録
        </h1>
        <p className="lead">呼び名と、最後に来た月だけで始められます。入れた行から自動で保存します。</p>
      </div>

      <section className="card stack-sm" aria-labelledby="bulk-common">
        <h2 className="section-title" id="bulk-common">
          この登録の共通設定
        </h2>
        <StewardFields
          steward={d.steward}
          channel={d.channel}
          onSteward={(s) => draft.set((p) => ({ ...p, steward: s, stewardAuto: false }))}
          onChannel={(c) => draft.set((p) => applyChannel(p, c))}
          stewardError={needSteward ? STEWARD_REQUIRED : null}
        />
      </section>

      <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="登録する行">
        {d.rows.map((r, i) => {
          const nk = r.nickname.trim() ? validateNickname(r.nickname, app.data.customers, r.customerId) : {}
          const parse = r.lastVisit.trim() ? parseLastVisitInput(r.lastVisit, app.today) : null
          const saved = !!idsOf(r).customerId && savedSig.current.get(r.key) === sigOf(r, d)
          const nId = `bulk-${r.key}-n`
          const lId = `bulk-${r.key}-l`
          return (
            <li key={r.key} className="card bulk-row">
              <div className="bulk-row-head">
                <span className="label">{i + 1}人目</span>
                {saved && (
                  <span className="saved-mark" role="status">
                    保存しました
                  </span>
                )}
              </div>
              <div className="field">
                <label className="field-label" htmlFor={nId}>
                  呼び名
                </label>
                <input
                  id={nId}
                  ref={(el) => {
                    if (el) inputs.current.set(`${r.key}:n`, el)
                    else inputs.current.delete(`${r.key}:n`)
                  }}
                  className="input"
                  value={r.nickname}
                  autoComplete="off"
                  enterKeyHint="next"
                  aria-invalid={!!nk.error}
                  onChange={(e) => setRow(r.key, { nickname: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      onEnter(r.key, 'n')
                    }
                  }}
                />
                {nk.error && (
                  <p className="error" role="alert">
                    {nk.error}
                  </p>
                )}
                {!nk.error && nk.warning && <p className="warn">{nk.warning}。呼び名に区別を足してください</p>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor={lId}>
                  最終来店（「8月」「2026-08」「8/22」など）
                </label>
                <input
                  id={lId}
                  ref={(el) => {
                    if (el) inputs.current.set(`${r.key}:l`, el)
                    else inputs.current.delete(`${r.key}:l`)
                  }}
                  className="input"
                  value={r.lastVisit}
                  autoComplete="off"
                  enterKeyHint="next"
                  aria-invalid={parse?.kind === 'error'}
                  onChange={(e) => setRow(r.key, { lastVisit: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      onEnter(r.key, 'l')
                    }
                  }}
                />
                {parse?.kind === 'error' && (
                  <p className="error" role="alert">
                    {LAST_VISIT_ERROR}
                  </p>
                )}
                {parse?.kind === 'date' && (
                  <p className="hint">
                    {parse.date}
                    {parse.approx ? '（おおよそ）' : ''}
                  </p>
                )}
              </div>
              <MenuChips label="主なメニュー" menus={app.data.menus} selected={r.menuIds} onChange={(ids) => setRow(r.key, { menuIds: ids })} />
              <details
                className="fold"
                open={r.override}
                onToggle={(e) => {
                  const open = (e.currentTarget as HTMLDetailsElement).open
                  if (open !== r.override)
                    setRow(r.key, open ? { override: true, steward: d.steward, channel: d.channel } : { override: false })
                }}
              >
                <summary>この行だけ管理者・経路を変える</summary>
                {r.override && (
                  <StewardFields
                    steward={r.steward}
                    channel={r.channel}
                    onSteward={(s) => setRow(r.key, { steward: s, stewardAuto: false })}
                    onChannel={(c) => setRow(r.key, applyChannel(r, c))}
                    stewardError={r.nickname.trim() && !r.steward ? STEWARD_REQUIRED : null}
                  />
                )}
              </details>
            </li>
          )
        })}
      </ol>

      {saveError && (
        <p className="alert" role="alert">
          {saveError}
        </p>
      )}

      <button type="button" className="btn btn-outline btn-block" onClick={() => focusKey(`${addRow()}:n`)}>
        ＋行を追加
      </button>
      {finishError && (
        <p className="alert" role="alert">
          {finishError}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-block" disabled={finishing} onClick={() => void finish()}>
        {savedCount > 0 ? `${savedCount}人を登録してホームへ` : 'ホームへ'}
      </button>
    </main>
  )
}
