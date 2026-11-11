/**
 * S5 顧客カード（前回の再現、4.6）。施術前・声かけ前に、その人の前回と次回の目安を1画面で見る。
 * 編集は1文字ごとに自動保存（0.3秒の間をおく）。削除は来店・連絡履歴もまとめて消し、10秒取り消せる。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  archiveCustomer,
  bookingDatePhrase,
  bookingResolutionLabel,
  candidateLabels,
  CHANNEL_LABELS,
  computeDueInfo,
  CONTACT_KIND_LABELS,
  CONTACT_METHOD_LABELS,
  CONTACT_VIA_LABELS,
  dueBasisReason,
  effectiveOpenBooking,
  formatDateWithWeekday,
  formatYearMonthJa,
  LIMITS,
  MESSAGES,
  menuText,
  nextPlanLabel,
  PERMISSION_LABELS,
  personalCycleText,
  STEWARD_LABELS,
  unarchiveCustomer,
  validateNickname,
  withContactPermission,
  type AcquisitionChannel,
  type ContactMethod,
  type ContactPermission,
  type Customer,
  type DataSteward,
  type Menu,
  type Visit,
} from '../../domain'
import { createDraftSaver } from '../../storage'
import { cancelBooking, skipKoekake, type SkipOption } from '../../state/actions'
import { useApp, useSettings } from '../../state/AppState'
import { contactsOf, customerById, useEligibility, visitsOf } from '../../state/derived'
import { useFeedback } from '../../state/feedback'
import { navigate, to } from '../../state/router'
import { nowISO } from '../../state/today'
import { Empty, Field, Segmented, StatusBadge, TopBar } from '../components/Basics'
import { applyChannel, MemoField, StewardFields } from '../components/Pickers'
import { Sheet } from '../components/Sheet'
import { SkipSheet } from './SkipSheet'

export const HOW_TO_TELL =
  '次回の目安のころにお知らせするため、お名前（呼び名）とご来店の記録を、私のスマホの中だけに残しています。お知らせが不要なときは、いつでも言ってください。'
export const NOT_LEGAL_ADVICE = '法的な助言ではありません。必要な対応はご自身で確認してください。'
export const MINOR_NOTE = '16歳未満のお客様への連絡は、保護者の方を通してください。'

export function CustomerCard({ id }: { id: string }) {
  const app = useApp()
  const settings = useSettings()
  const { toast, offerUndo } = useFeedback()
  const elig = useEligibility()
  const { customers, visits, contacts, menus } = app.data
  const today = app.today
  const customer = customerById(customers, id)
  const [showAll, setShowAll] = useState(false)
  const [editing, setEditing] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // 二重に押したときの2回目を無視する（削除を2回走らせると、取り消しの窓が確定して完全に消えてしまう）
  const working = useRef(false)

  const due = useMemo(
    () => (customer ? (elig?.dueById.get(customer.id) ?? computeDueInfo(customer, visits, menus, settings, today)) : null),
    [customer, elig, visits, menus, settings, today],
  )

  if (!customer || !due) {
    return (
      <main className="screen stack">
        <TopBar back="#/customers" />
        <p className="muted">このお客様は見つかりませんでした。</p>
      </main>
    )
  }

  const self = `#/customer/${encodeURIComponent(customer.id)}`
  const own = visitsOf(visits, customer.id, today).slice().reverse()
  const shownVisits = showAll ? own : own.slice(0, 3)
  const logs = contactsOf(contacts, customer.id).slice(0, 5)
  const first = candidateLabels(customer, visits, due, today).includes('first_visit')
  const isSalon = customer.stewardship.steward === 'salon'
  const booking = effectiveOpenBooking(customer, visits, today)
  const bookingHref = to('/booking', { c: customer.id, back: self })

  /** 保存の操作を1つずつ行い、失敗したら知らせる（4.6 エラー時） */
  const once = async (fn: () => Promise<void>) => {
    if (working.current) return
    working.current = true
    setBusy(true)
    try {
      await fn()
    } catch {
      toast(MESSAGES.saveFailed)
    } finally {
      working.current = false
      setBusy(false)
    }
  }

  const onSkip = (option: SkipOption) =>
    once(async () => {
      await app.mutate((repo) => skipKoekake(repo, { customer, option, due, today, now: nowISO() }))
      setSkipOpen(false)
      toast(option === 'no_contact' ? '「連絡しない」にしました' : '今回は見送りました')
    })

  const onArchive = (reason: 'stopped' | 'moved' | 'other') =>
    once(async () => {
      await app.mutate((repo) => repo.putCustomer(archiveCustomer(customer, reason, { today, now: nowISO() })))
      setArchiveOpen(false)
      toast('リストから外しました')
    })

  const onUnarchive = () =>
    once(async () => {
      await app.mutate((repo) => repo.putCustomer(unarchiveCustomer(customer, nowISO())))
      toast('リストに戻しました')
    })

  const onCancelBooking = () =>
    once(async () => {
      const repo = app.repo
      if (!repo) return
      if (!booking) return
      const undo = await app.mutate((r) => cancelBooking(r, { customer, booking, now: nowISO() }))
      offerUndo({
        key: `booking:${customer.id}`,
        message: `${customer.nickname}さんの予約を取り消しました`,
        undo,
        routeHash: self,
      })
    })

  const onDelete = () =>
    once(async () => {
      const repo = app.repo
      if (!repo) return
      const at = await app.mutate((r) => r.softDeleteCustomer(customer.id, nowISO()))
      const target = '#/customers'
      navigate(target)
      offerUndo({
        key: `customer:${customer.id}`,
        message: `${customer.nickname}さんを削除しました`,
        undo: () => repo.restoreCustomer(customer.id, at),
        commit: () => repo.purgeCustomer(customer.id),
        routeHash: target,
      })
    })

  return (
    <main className="screen stack" aria-labelledby="card-title">
      <div className="stack-xs">
        <TopBar back="#/customers" backLabel="お客様" />
        {customer.pinnedMemo && <p className="memo-box">{customer.pinnedMemo}</p>}
        <div className="candidate-head">
          <h1 className="name-lg" id="card-title">
            {customer.nickname}
          </h1>
          {app.isSample && <span className="tag">サンプル</span>}
        </div>
        {((customer.kana && customer.kana !== customer.nickname) || customer.lineDisplayName) && (
          <p className="meta">
            {[customer.kana && customer.kana !== customer.nickname ? customer.kana : '', customer.lineDisplayName ? `LINE表示名 ${customer.lineDisplayName}` : '']
              .filter(Boolean)
              .join('・')}
          </p>
        )}
        <div className="badges" style={{ marginTop: 8 }}>
          <span className={isSalon ? 'badge badge-salon' : 'badge'}>管理者 {STEWARD_LABELS[customer.stewardship.steward]}</span>
          <span className="badge">{CHANNEL_LABELS[customer.stewardship.channel]}</span>
          <span className="badge">連絡 {PERMISSION_LABELS[customer.contact.permission]}</span>
          {first && <span className="badge badge-soon">はじめて</span>}
        </div>
        {customer.contact.permission !== 'unknown' && customer.contact.confirmedOn ? (
          <p className="meta">
            連絡{PERMISSION_LABELS[customer.contact.permission]}を確かめた日 {formatDateWithWeekday(customer.contact.confirmedOn)}
            {customer.contact.method ? `（${CONTACT_METHOD_LABELS[customer.contact.method]}）` : ''}
          </p>
        ) : customer.contact.permission === 'no' ? (
          <p className="meta">本人には確かめていません（美容師の判断）</p>
        ) : null}
      </div>

      <section className="card-flat stack-sm" aria-labelledby="booking-head">
        <div className="kv">
          <h2 className="label" id="booking-head">
            予約
          </h2>
          {booking ? (
            <strong>{bookingDatePhrase(booking.date, today)}</strong>
          ) : (
            <span className="muted small">入っていません</span>
          )}
        </div>
        {booking && (
          <p className="meta">{booking.source === 'customer' ? 'あとから入れた予約' : '会計時に入れた予約'}</p>
        )}
        {booking ? (
          <div className="btn-pair">
            <a className="btn btn-sm" href={bookingHref}>
              予約日を変える
            </a>
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void onCancelBooking()}>
              予約を取り消す
            </button>
          </div>
        ) : (
          <a className="btn btn-outline btn-sm" href={bookingHref}>
            予約日を入れる
          </a>
        )}
      </section>

      {own.length === 0 ? (
        <Empty
          actions={
            <a className="btn btn-primary" href={to('/visit', { c: customer.id, back: self })}>
              来店を追加
            </a>
          }
        >
          最終来店を入れると、次回の目安が出ます
        </Empty>
      ) : (
        <section className="card stack-sm" aria-label="次回の目安">
          <div className="kv">
            <span className="label">今の区分</span>
            <StatusBadge status={due.status} />
          </div>
          {due.dueDate && (
            <div>
              <p className="label">次回の目安日</p>
              <p className="metric-line">
                <strong>{formatDateWithWeekday(due.dueDate)}</strong>
              </p>
              <p className="meta">{dueBasisReason(due, menus, settings)}</p>
            </div>
          )}
          <div>
            <p className="label">いつもの周期</p>
            <p className="metric-line">{personalCycleText(due)}</p>
          </div>
        </section>
      )}

      <div className="btn-pair">
        <a className="btn btn-primary" href={to('/visit', { c: customer.id, same: 1, back: self })}>
          来店を記録
        </a>
        <a className="btn btn-primary" href={`#/koekake/${encodeURIComponent(customer.id)}?from=card`}>
          声をかける
        </a>
      </div>

      {own.length > 0 && (
        <section aria-labelledby="visits-title">
          <div className="section-head">
            <h2 className="section-title" id="visits-title">
              {showAll ? 'すべての来店' : '直近の来店'}
            </h2>
          </div>
          <ul className="list">
            {shownVisits.map((v) => (
              <VisitItem key={v.id} v={v} menus={menus} back={self} />
            ))}
          </ul>
          {own.length > 3 && (
            <button type="button" className="toggle-more" onClick={() => setShowAll((x) => !x)} aria-expanded={showAll}>
              {showAll ? '直近の3回だけ見る' : `すべての来店（${own.length}回）`}
            </button>
          )}
        </section>
      )}

      <section aria-labelledby="logs-title">
        <h2 className="section-title" id="logs-title" style={{ marginBottom: 12 }}>
          連絡履歴
        </h2>
        {logs.length === 0 ? (
          <p className="muted small">まだありません</p>
        ) : (
          <ul className="list">
            {logs.map((l) => (
              <li key={l.id} className="list-item" style={{ minHeight: 48 }}>
                <span className="grow">{formatDateWithWeekday(l.date)}</span>
                <span className="meta">
                  {CONTACT_KIND_LABELS[l.kind]}・{CONTACT_VIA_LABELS[l.via]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="fold">
        <summary>お客様への伝え方の例</summary>
        <div className="stack-xs" style={{ paddingBottom: 8 }}>
          <p className="memo-box">{HOW_TO_TELL}</p>
          <p className="hint">{MINOR_NOTE}</p>
          <p className="hint">{NOT_LEGAL_ADVICE}</p>
        </div>
      </details>

      {editing ? (
        <CustomerEditor customer={customer} onDone={() => setEditing(false)} />
      ) : (
        <div className="stack-sm">
          <div className="btn-pair">
            <button type="button" className="btn" onClick={() => setSkipOpen(true)}>
              今回は見送る
            </button>
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              編集
            </button>
          </div>
          {customer.archived ? (
            <button type="button" className="btn btn-outline btn-block" disabled={busy} onClick={() => void onUnarchive()}>
              リストに戻す
            </button>
          ) : (
            <button type="button" className="btn btn-outline btn-block" onClick={() => setArchiveOpen(true)}>
              リストから外す
              <span className="visually-hidden">（来なくなった・引っ越しなど）</span>
            </button>
          )}
          <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={() => void onDelete()}>
            削除
          </button>
        </div>
      )}

      {skipOpen && <SkipSheet onClose={() => setSkipOpen(false)} onPick={onSkip} busy={busy} />}
      {archiveOpen && (
        <Sheet title="リストから外す" onClose={() => setArchiveOpen(false)}>
          <div className="stack-sm">
            <p className="muted small">声かけ候補に出なくなります。来店を記録すると自動で戻ります。</p>
            <button type="button" className="btn btn-block" disabled={busy} onClick={() => void onArchive('stopped')}>
              来なくなった
            </button>
            <button type="button" className="btn btn-block" disabled={busy} onClick={() => void onArchive('moved')}>
              引っ越し
            </button>
            <button type="button" className="btn btn-block" disabled={busy} onClick={() => void onArchive('other')}>
              その他
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setArchiveOpen(false)}>
              やめる
            </button>
          </div>
        </Sheet>
      )}
    </main>
  )
}

function VisitItem({ v, menus, back }: { v: Visit; menus: readonly Menu[]; back: string }) {
  return (
    <li>
      <a className="list-link" href={to(`/visit/${encodeURIComponent(v.id)}`, { back })} style={{ alignItems: 'flex-start' }}>
        <div className="grow stack-xs">
          <p style={{ fontWeight: 700 }}>
            {v.dateApprox ? `${formatYearMonthJa(v.date)}（おおよそ）` : formatDateWithWeekday(v.date)}
          </p>
          <p className="meta">
            {menuText(v.menuIds, menus) || 'メニューなし'}・次回 {nextPlanLabel(v.next)}
            {v.bookingResolution ? `（${bookingResolutionLabel(v.bookingResolution)}）` : ''}
            {v.price != null ? `・${v.price.toLocaleString('ja-JP')}円` : ''}
          </p>
          {v.recipe?.text && <p className="meta pre">レシピ: {v.recipe.text}</p>}
          {v.talkMemo && <p className="meta pre">会話: {v.talkMemo}</p>}
        </div>
        <span className="small" style={{ color: 'var(--accent)', flex: 'none' }}>
          直す
        </span>
      </a>
    </li>
  )
}

interface EditForm {
  nickname: string
  kana: string
  line: string
  memo: string
  steward?: DataSteward
  channel?: AcquisitionChannel
  stewardAuto?: boolean
  permission: ContactPermission
  /** 本人に確かめた方法（OK／しない のとき） */
  method?: ContactMethod
}

function CustomerEditor({ customer, onDone }: { customer: Customer; onDone: () => void }) {
  const app = useApp()
  const [form, setForm] = useState<EditForm>(() => ({
    nickname: customer.nickname,
    kana: customer.kana ?? '',
    line: customer.lineDisplayName ?? '',
    memo: customer.pinnedMemo ?? '',
    steward: customer.stewardship.steward,
    channel: customer.stewardship.channel,
    permission: customer.contact.permission,
    method: customer.contact.method,
  }))
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')
  const latest = useRef(customer)
  latest.current = customer
  const appRef = useRef(app)
  appRef.current = app
  const formRef = useRef(form)
  const nick = validateNickname(form.nickname, app.data.customers, customer.id)

  const saver = useMemo(
    () =>
      createDraftSaver<EditForm>(async (f) => {
        const cur = latest.current
        const a = appRef.current
        const check = validateNickname(f.nickname, a.data.customers, cur.id)
        if (check.error || !f.steward || !f.channel) return
        const now = nowISO()
        const today = a.today
        let next: Customer = { ...cur, nickname: f.nickname.trim(), updatedAt: now }
        const setOpt = (k: 'kana' | 'lineDisplayName' | 'pinnedMemo', v: string) => {
          if (v.trim()) next = { ...next, [k]: v.trim() }
          else {
            const copy = { ...next }
            delete copy[k]
            next = copy
          }
        }
        setOpt('kana', f.kana)
        setOpt('lineDisplayName', f.line)
        setOpt('pinnedMemo', f.memo)
        if (f.steward !== cur.stewardship.steward || f.channel !== cur.stewardship.channel) {
          next = { ...next, stewardship: { steward: f.steward, channel: f.channel, decidedOn: today } }
        }
        const method = f.method ?? 'in_person'
        // 方法は、選び直したときだけ書き換える（ほかの欄の編集で「確かめた日」を今日にしない）
        if (f.permission !== cur.contact.permission || (f.permission !== 'unknown' && f.method !== undefined && f.method !== cur.contact.method)) {
          next = withContactPermission(next, f.permission, { today, now, method })
        }
        try {
          await a.mutate((repo) => repo.putCustomer(next))
          setState('saved')
        } catch {
          setState('error')
        }
      }),
    // 画面を開いているあいだは同じ保存係を使う
    [],
  )

  useEffect(() => {
    const flush = () => void saver.flush().catch(() => undefined)
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVis)
      flush()
    }
  }, [saver])

  const update = (patch: Partial<EditForm>) => {
    const next = { ...formRef.current, ...patch }
    formRef.current = next
    setForm(next)
    saver.schedule(next)
    setState('idle')
  }

  return (
    <section className="card stack" aria-labelledby="edit-title">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h2 className="section-title" id="edit-title">
          編集
        </h2>
        <span className="small" role="status" style={{ color: state === 'error' ? 'var(--danger)' : 'var(--text-muted)' }}>
          {state === 'saved' ? '保存しました' : state === 'error' ? '保存できませんでした' : '入力すると自動で保存します'}
        </span>
      </div>
      <Field label="呼び名" required error={nick.error ?? (state === 'error' ? '保存できませんでした' : null)} warning={nick.warning}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            className="input"
            value={form.nickname}
            maxLength={40}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onChange={(e) => update({ nickname: e.target.value })}
          />
        )}
      </Field>
      <Field label="かな（検索用）">
        {({ id }) => <input id={id} className="input" value={form.kana} onChange={(e) => update({ kana: e.target.value })} />}
      </Field>
      <Field label="LINE表示名（任意）" hint="送り先を選ぶときの目印です">
        {({ id, describedBy }) => (
          <input id={id} className="input" value={form.line} aria-describedby={describedBy} onChange={(e) => update({ line: e.target.value })} />
        )}
      </Field>
      <MemoField label="一言メモ（上部に固定）" value={form.memo} maxLength={LIMITS.pinnedMemo} single onChange={(v) => update({ memo: v })} />
      <StewardFields
        steward={form.steward}
        channel={form.channel}
        onSteward={(s) => update({ steward: s, stewardAuto: false })}
        onChannel={(c) => update(applyChannel(form, c))}
        stewardError={form.steward ? null : 'データの管理者を選んでください'}
      />
      <Segmented<ContactPermission>
        label="連絡"
        options={[
          { value: 'ok', label: PERMISSION_LABELS.ok },
          { value: 'no', label: PERMISSION_LABELS.no },
          { value: 'unknown', label: PERMISSION_LABELS.unknown },
        ]}
        value={form.permission}
        onChange={(p) => update({ permission: p, method: p === 'unknown' ? undefined : (form.method ?? 'in_person') })}
      />
      {form.permission !== 'unknown' && (
        <Segmented<ContactMethod>
          label="本人に確かめた方法"
          options={[
            { value: 'in_person', label: CONTACT_METHOD_LABELS.in_person },
            { value: 'message', label: CONTACT_METHOD_LABELS.message },
          ]}
          value={form.method}
          onChange={(m) => update({ method: m })}
        />
      )}
      <button
        type="button"
        className="btn btn-outline btn-block"
        onClick={() => {
          void saver.flush()
          onDone()
        }}
      >
        閉じる
      </button>
    </section>
  )
}
