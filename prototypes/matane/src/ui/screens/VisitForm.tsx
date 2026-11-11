/**
 * S2 来店記録（4.3）。会計の30秒で来店と次回の約束を残す。保存したらまたねカードを出す。
 * 入力は0.3秒ごとに下書き保存し、開き直すと戻る（6.1）。
 * - '#/visit?c=<id>&same=1&date=<d>&src=fix&back=<戻る先>&done=<保存後の行き先>&focus=date'
 * - '#/visit/<visitId>' は直す（削除もここから。10秒取り消せる）
 */
import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  copyRecipeFrom,
  formatMonthDayJa,
  isValidISODate,
  lastVisitOf,
  latestVisitWithRecipe,
  matchKey,
  MESSAGES,
  parseOneLine,
  parsePriceInput,
  PERMISSION_LABELS,
  sameDayConflict,
  validateNickname,
  validateVisitInput,
  VALIDATION_MESSAGES,
  type ContactPermission,
  type Customer,
  type NextPlan,
  type Visit,
  type VisitSource,
} from '../../domain'
import { saveVisit } from '../../state/actions'
import { useApp } from '../../state/AppState'
import { customerById, recentCustomers, visitsOf } from '../../state/derived'
import { useFeedback } from '../../state/feedback'
import { navigate, to } from '../../state/router'
import { nowISO } from '../../state/today'
import { useDraft } from '../../state/useDraft'
import { Field, Segmented, TopBar } from '../components/Basics'
import { applyChannel, CustomerPicker, MemoField, MenuChips, NextChips, StewardFields, type NewCustomerValue } from '../components/Pickers'
import { MataneSheet } from './MataneSheet'

export const SAVE_FAILED = MESSAGES.saveFailed
export const CONTACT_ASK_EXAMPLE = '聞き方の例:「目安のころにLINEでお知らせしてもいいですか？」'

interface VisitDraft {
  customerId?: string
  newCustomer?: NewCustomerValue
  date: string
  menuIds: string[]
  next: NextPlan
  permission?: ContactPermission
  price: string
  recipe: string
  recipeCopiedFrom?: string
  talkMemo: string
  oneLine: string
  usedOneLine: boolean
  detailsOpen: boolean
  /** 最後に入力した日（端末の日付）。日をまたいだ新規の下書きは、日付を置き直して戻す */
  savedOn?: string
}

interface Errors {
  customer?: string
  nickname?: string
  steward?: string
  channel?: string
  date?: string
  menu?: string
  next?: string
  price?: string
  other?: string[]
}

function restoreDraft(d: unknown): VisitDraft | null {
  if (!d || typeof d !== 'object') return null
  const x = d as Partial<VisitDraft>
  if (typeof x.date !== 'string' || !Array.isArray(x.menuIds) || !x.next || typeof x.next !== 'object') return null
  return {
    customerId: x.customerId,
    newCustomer: x.newCustomer,
    date: x.date,
    menuIds: x.menuIds,
    next: x.next,
    permission: x.permission,
    price: x.price ?? '',
    recipe: x.recipe ?? '',
    recipeCopiedFrom: x.recipeCopiedFrom,
    talkMemo: x.talkMemo ?? '',
    oneLine: x.oneLine ?? '',
    usedOneLine: !!x.usedOneLine,
    detailsOpen: !!x.detailsOpen,
    savedOn: typeof x.savedOn === 'string' ? x.savedOn : undefined,
  }
}

function fromVisit(v: Visit): VisitDraft {
  return {
    customerId: v.customerId,
    date: v.date,
    menuIds: [...v.menuIds],
    next: v.next,
    price: v.price != null ? String(v.price) : '',
    recipe: v.recipe?.text ?? '',
    recipeCopiedFrom: v.recipe?.copiedFromVisitId,
    talkMemo: v.talkMemo ?? '',
    oneLine: '',
    usedOneLine: false,
    detailsOpen: !!(v.price != null || v.recipe?.text || v.talkMemo),
  }
}

export function VisitForm({ editId, params }: { editId?: string; params: URLSearchParams }) {
  const app = useApp()
  const { toast, offerUndo } = useFeedback()
  const { customers, visits, menus } = app.data
  const today = app.today

  const editing = editId ? visits.find((v) => v.id === editId && !v.deletedAt) : undefined
  const preset = customerById(customers, editing?.customerId ?? params.get('c'))
  const source: VisitSource = editing ? editing.source : params.get('src') === 'fix' ? 'fix' : 'checkout'
  const back =
    params.get('back') ?? (editing ? `#/customer/${encodeURIComponent(editing.customerId)}` : preset ? `#/customer/${encodeURIComponent(preset.id)}` : '#/')
  const done = params.get('done') ?? back
  const formId = editing
    ? `visit:edit:${editing.id}`
    : preset
      ? `visit:${source === 'fix' ? 'fix' : 'new'}:${preset.id}`
      : 'visit:new'

  const pd = params.get('date')
  const urlDate = pd && isValidISODate(pd) && pd <= today ? pd : undefined
  /** 日をまたいだ新規の下書きを戻したとき、その下書きを書いていた日 */
  const restoredFrom = useRef<string | null>(null)
  const draft = useDraft<VisitDraft>(
    formId,
    () => {
      if (editing) return { ...fromVisit(editing), savedOn: today }
      const prev = preset ? lastVisitOf(visitsOf(visits, preset.id, today), today) : undefined
      return {
        customerId: preset?.id,
        date: urlDate ?? today,
        menuIds: params.get('same') && prev ? [...prev.menuIds] : [],
        next: { kind: 'none' },
        price: '',
        recipe: '',
        talkMemo: '',
        oneLine: '',
        usedOneLine: false,
        detailsOpen: false,
        savedOn: today,
      }
    },
    (d) => {
      const x = restoreDraft(d)
      if (!x || editing) return x
      // 新規の記録では、開いたときの日付（来た？の予約日など）を下書きより優先する。
      // 日をまたいだ下書きは日付を今日に置き直す（3タップの記録で、前の日付のまま保存しないように）
      if (x.savedOn !== today) {
        restoredFrom.current = x.savedOn ?? 'unknown'
        return { ...x, date: urlDate ?? today, savedOn: today }
      }
      return urlDate ? { ...x, date: urlDate } : x
    },
  )
  const f = draft.value
  const set = (patch: Partial<VisitDraft>) => draft.set((p) => ({ ...p, ...patch, savedOn: today }))
  const [oneLineOpen, setOneLineOpen] = useState(false)
  const removing = useRef(false)

  const customer = customerById(customers, f.customerId)
  const ownVisits = useMemo(
    () => (customer ? visitsOf(visits, customer.id, today).filter((v) => v.id !== editing?.id) : []),
    [customer, visits, today, editing?.id],
  )
  const prevVisit = ownVisits.length ? ownVisits[ownVisits.length - 1] : undefined
  const recipeSource = latestVisitWithRecipe(ownVisits, today)
  const recent = useMemo(() => recentCustomers(customers, visits, 5), [customers, visits])

  const [errors, setErrors] = useState<Errors>({})
  const [conflict, setConflict] = useState<Visit | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState<{ customer: Customer; visit: Visit } | null>(null)
  const [parsed, setParsed] = useState<{ unparsed: string[]; warnings: string[]; candidates: Customer[] } | null>(null)

  const permission: ContactPermission = f.permission ?? customer?.contact.permission ?? 'unknown'

  const applyOneLine = () => {
    const text = f.oneLine.trim()
    if (!text) return
    // 日付欄が空・不正なときは今日を来店日として読む（予約日の年を決めるため）
    const res = parseOneLine(text, isValidISODate(f.date) ? f.date : today, customers, menus, customer)
    const patch: Partial<VisitDraft> = { usedOneLine: true }
    let candidates: Customer[] = []
    if (res.nameToken) {
      const first = res.customerMatches[0]
      const exact = first && (matchKey(first.nickname) === matchKey(res.nameToken) || (!!first.kana && matchKey(first.kana) === matchKey(res.nameToken)))
      if (exact) {
        patch.customerId = first.id
        patch.newCustomer = undefined
      } else if (res.customerMatches.length > 0) {
        candidates = res.customerMatches
      } else {
        patch.customerId = undefined
        patch.newCustomer = { nickname: res.nameToken }
      }
    }
    if (res.menuIds.length) patch.menuIds = res.menuIds
    if (res.next) patch.next = res.next
    if (res.price != null) {
      patch.price = String(res.price)
      patch.detailsOpen = true
    }
    set(patch)
    setParsed({ unparsed: res.unparsed, warnings: res.warnings, candidates })
  }

  const save = async (force = false) => {
    const e: Errors = {}
    const other: string[] = []
    if (!customer && !f.newCustomer) e.customer = 'お客様を選んでください'
    if (!customer && f.newCustomer) {
      const nk = validateNickname(f.newCustomer.nickname, customers)
      if (nk.error) e.nickname = nk.error
      if (!f.newCustomer.steward) e.steward = 'データの管理者を選んでください'
      if (!f.newCustomer.channel) e.channel = '獲得経路を選んでください'
    }
    if (f.next.kind === 'booked' && !isValidISODate(f.next.date)) e.next = '予約日を入れてください'
    const price = parsePriceInput(f.price)
    if (price === null) e.price = VALIDATION_MESSAGES.price
    if (!isValidISODate(f.date)) e.date = '日付を入れてください'
    else {
      const errs = validateVisitInput(
        {
          date: f.date,
          menuIds: f.menuIds,
          next: f.next,
          price: price ?? undefined,
          talkMemo: f.talkMemo,
          recipeText: f.recipe,
          allowNoMenu: editing?.source === 'bulk',
        },
        today,
      )
      for (const m of errs) {
        if (m === VALIDATION_MESSAGES.menuRequired) e.menu = m
        else if (m === VALIDATION_MESSAGES.futureDate) e.date = m
        else if (m === VALIDATION_MESSAGES.bookedNotAfter) e.next = e.next ?? m
        else if (m === VALIDATION_MESSAGES.price) e.price = m
        else other.push(m)
      }
    }
    if (other.length) e.other = other
    setErrors(e)
    setSaveError(null)
    if (Object.keys(e).length > 0) return
    if (customer && !force) {
      const dup = sameDayConflict(visits, customer.id, f.date, editing?.id)
      if (dup) {
        setConflict(dup)
        return
      }
    }
    setConflict(null)
    setBusy(true)
    try {
      const now = nowISO()
      const res = await app.mutate((repo) =>
        saveVisit(repo, {
          customer,
          newCustomer:
            !customer && f.newCustomer && f.newCustomer.steward && f.newCustomer.channel
              ? { nickname: f.newCustomer.nickname, steward: f.newCustomer.steward, channel: f.newCustomer.channel }
              : undefined,
          fields: {
            date: f.date,
            menuIds: f.menuIds,
            next: f.next,
            price: price ?? undefined,
            recipe: f.recipe.trim() ? { text: f.recipe, copiedFromVisitId: f.recipeCopiedFrom } : undefined,
            talkMemo: f.talkMemo.trim() ? f.talkMemo : undefined,
          },
          source: !editing && source === 'checkout' && f.usedOneLine ? 'one_line' : source,
          permission: f.permission,
          editing,
          today,
          now,
        }),
      )
      await draft.clear()
      if (res.unarchived) toast('リストに戻しました')
      if (editing) {
        toast('来店記録を直しました')
        navigate(done)
      } else if (source === 'fix') {
        navigate(done)
      } else if (f.date === today) {
        setSheet({ customer: res.customer, visit: res.visit })
      } else {
        toast('来店を記録しました')
        navigate(done)
      }
    } catch {
      setSaveError(SAVE_FAILED)
      await draft.flush().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  const removeVisit = async () => {
    if (!editing) return
    const id = editing.id
    const repo = app.repo
    if (!repo) return
    // 二重に押したときの2回目を無視する（取り消しの窓が確定して完全に消えてしまわないように）
    if (removing.current) return
    removing.current = true
    setBusy(true)
    try {
      await app.mutate((r) => r.softDeleteVisit(id, nowISO()))
    } catch {
      setSaveError(SAVE_FAILED)
      removing.current = false
      setBusy(false)
      return
    }
    await draft.clear()
    const target = `#/customer/${encodeURIComponent(editing.customerId)}`
    navigate(target)
    offerUndo({
      key: `visit:${id}`,
      message: '来店記録を削除しました',
      undo: () => repo.restoreVisit(id),
      commit: () => repo.purgeVisit(id),
      routeHash: target,
    })
  }

  if (editId && !editing) {
    return (
      <main className="screen stack">
        <TopBar back="#/" />
        <p className="muted">この来店記録は見つかりませんでした。</p>
      </main>
    )
  }

  const title = editing ? '来店記録を直す' : source === 'fix' ? '来店を追加' : '来店を記録'

  // 客が決まった状態で開いたとき（今日のお客様の［来た］など）は、1行入力を折りたたみ、次回のチップを上に置く。
  // ［来た］→［6週など］→［保存］の3タップ（2.3・4.3）が、最初の画面の中で済むように
  const quick = !!preset && !editing
  const oneLineField = (
    <div className="field">
      <label className="field-label" htmlFor="one-line">
        1行で入れる（例: ゆず カットカラー 6週）
      </label>
      <div className="inline-input">
        <input
          id="one-line"
          className="input"
          value={f.oneLine}
          autoComplete="off"
          enterKeyHint="done"
          aria-describedby="one-line-hint"
          onChange={(e) => set({ oneLine: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              applyOneLine()
            }
          }}
        />
        <button type="button" className="btn" onClick={applyOneLine}>
          読み取る
        </button>
      </div>
      <p className="hint" id="one-line-hint">
        キーボードの音声入力も使えます。読み取った内容は下の欄に入ります（自動では保存しません）。
      </p>
      {parsed && parsed.unparsed.length > 0 && (
        <p className="warn" role="status">
          読み取れなかった語: {parsed.unparsed.join('、')}
        </p>
      )}
      {parsed?.warnings.map((w) => (
        <p key={w} className="warn">
          {w}
        </p>
      ))}
    </div>
  )
  const oneLineSection: ReactNode = editing ? null : quick ? (
    <div>
      <button
        type="button"
        className="toggle-more"
        aria-expanded={oneLineOpen || !!f.oneLine}
        aria-controls="one-line-box"
        onClick={() => setOneLineOpen((v) => !v)}
      >
        {oneLineOpen || f.oneLine ? '▲' : '▼'} 1行で入れる
      </button>
      <div id="one-line-box" hidden={!(oneLineOpen || f.oneLine)} style={{ marginTop: 8 }}>
        {oneLineField}
      </div>
    </div>
  ) : (
    oneLineField
  )
  const dateField = (
    <Field label="日付" error={errors.date}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          className="input input-date"
          type="date"
          max={today}
          value={f.date}
          autoFocus={params.get('focus') === 'date'}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => set({ date: e.target.value })}
        />
      )}
    </Field>
  )
  const menuField = (
    <MenuChips menus={menus} selected={f.menuIds} onChange={(ids) => set({ menuIds: ids })} previous={prevVisit?.menuIds} error={errors.menu} />
  )
  const nextField = (
    <NextChips value={f.next} onChange={(n) => set({ next: n })} visitDate={f.date} error={errors.next} />
  )

  return (
    <main className="screen stack" aria-labelledby="visit-title">
      <div>
        <TopBar back={back} />
        <h1 className="title" id="visit-title">
          {title}
        </h1>
        {draft.restored &&
          (restoredFrom.current ? (
            <p className="warn" role="status">
              {restoredFrom.current === 'unknown' ? '前に' : `${formatMonthDayJa(restoredFrom.current)}に`}
              入力していた内容を戻しました。日付は{f.date === today ? '今日' : f.date}にしています。確かめてください
            </p>
          ) : (
            <p className="hint">入力途中の内容を戻しました</p>
          ))}
      </div>

      {quick ? null : oneLineSection}

      <section aria-label="お客様">
        {customer ? (
          <div className="card-flat" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="grow">
              <p className="label">お客様</p>
              <p className="name-lg">{customer.nickname}</p>
              {prevVisit && <p className="meta">前回 {prevVisit.date}</p>}
            </div>
            {!editing && !preset && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => set({ customerId: undefined })}>
                変更
              </button>
            )}
          </div>
        ) : f.newCustomer ? (
          <div className="card-flat stack-sm">
            <div className="section-head" style={{ marginBottom: 0 }}>
              <h2 className="section-title">新しいお客様として登録</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ newCustomer: undefined })}>
                やめる
              </button>
            </div>
            <Field label="呼び名" required error={errors.nickname} warning={validateNickname(f.newCustomer.nickname, customers).warning}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  className="input"
                  value={f.newCustomer?.nickname ?? ''}
                  autoComplete="off"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  onChange={(e) => set({ newCustomer: { ...f.newCustomer!, nickname: e.target.value } })}
                />
              )}
            </Field>
            <StewardFields
              steward={f.newCustomer.steward}
              channel={f.newCustomer.channel}
              channelPlaceholder
              stewardError={errors.steward}
              channelError={errors.channel}
              onSteward={(s) => set({ newCustomer: { ...f.newCustomer!, steward: s, stewardAuto: false } })}
              onChannel={(c) => set({ newCustomer: applyChannel(f.newCustomer!, c) })}
            />
          </div>
        ) : (
          <div className="stack-sm">
            {parsed && parsed.candidates.length > 0 && (
              <div className="field">
                <p className="field-label">どの方ですか？</p>
                <div className="chips">
                  {parsed.candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="chip"
                      onClick={() => {
                        set({ customerId: c.id, newCustomer: undefined })
                        setParsed((p) => (p ? { ...p, candidates: [] } : p))
                      }}
                    >
                      {c.nickname}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <CustomerPicker
              customers={customers}
              recent={recent}
              onPick={(c) => set({ customerId: c.id, newCustomer: undefined })}
              onNew={(nickname) => set({ newCustomer: { nickname } })}
            />
            {errors.customer && (
              <p className="error" role="alert">
                {errors.customer}
              </p>
            )}
          </div>
        )}
      </section>

      {quick && oneLineSection}

      {quick ? (
        <>
          {nextField}
          {menuField}
          {dateField}
        </>
      ) : (
        <>
          {dateField}
          {menuField}
          {nextField}
        </>
      )}

      <div className="field">
        <Segmented<ContactPermission>
          label="連絡"
          options={[
            { value: 'ok', label: PERMISSION_LABELS.ok },
            { value: 'no', label: PERMISSION_LABELS.no },
            { value: 'unknown', label: PERMISSION_LABELS.unknown },
          ]}
          value={permission}
          onChange={(p) => set({ permission: p })}
        />
        <p className="hint">{CONTACT_ASK_EXAMPLE}</p>
      </div>

      <div>
        <button
          type="button"
          className="toggle-more"
          aria-expanded={f.detailsOpen}
          aria-controls="visit-details"
          onClick={() => set({ detailsOpen: !f.detailsOpen })}
        >
          {f.detailsOpen ? '▲' : '▼'} くわしく
        </button>
        <div id="visit-details" className="stack" hidden={!f.detailsOpen} style={{ marginTop: 8 }}>
          <Field label="金額（任意）" error={errors.price}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                className="input input-num"
                inputMode="numeric"
                autoComplete="off"
                value={f.price}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={(e) => set({ price: e.target.value })}
              />
            )}
          </Field>
          <MemoField
            label="レシピメモ"
            value={f.recipe}
            rows={3}
            maxLength={1000}
            onChange={(v) => set({ recipe: v })}
            extra={
              recipeSource ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    const r = copyRecipeFrom(recipeSource)
                    if (r) set({ recipe: r.text, recipeCopiedFrom: r.copiedFromVisitId })
                  }}
                >
                  前回のメモを複製
                </button>
              ) : undefined
            }
          />
          <MemoField label="会話メモ" value={f.talkMemo} rows={3} maxLength={500} onChange={(v) => set({ talkMemo: v })} />
        </div>
      </div>

      {errors.other?.map((m) => (
        <p key={m} className="error" role="alert">
          {m}
        </p>
      ))}

      {conflict && (
        <div className="stack-sm" role="alert">
          <p className="alert">{VALIDATION_MESSAGES.sameDay}</p>
          <div className="btn-pair">
            <a className="btn btn-outline" href={to(`/visit/${encodeURIComponent(conflict.id)}`, { back })}>
              その記録を開く
            </a>
            <button type="button" className="btn btn-primary" onClick={() => void save(true)}>
              それでも保存
            </button>
          </div>
        </div>
      )}

      {saveError && (
        <p className="alert" role="alert">
          {saveError}
        </p>
      )}

      <button type="button" className="btn btn-primary btn-block sticky-save" style={{ minHeight: 56 }} disabled={busy} onClick={() => void save()}>
        保存
      </button>

      {editing && (
        <button type="button" className="btn btn-danger btn-block" onClick={() => void removeVisit()}>
          この来店記録を削除
        </button>
      )}

      {sheet && (
        <MataneSheet
          customer={sheet.customer}
          visit={sheet.visit}
          onDone={() => {
            setSheet(null)
            navigate(done)
          }}
        />
      )}
    </main>
  )
}
