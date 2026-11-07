/**
 * S4 声かけ（送る前の確認、4.5）。記録の抜けを確かめてから、自分の言葉に直した文面を自分で送る。
 * 所属サロンの顧客では、文面の前に注意の確認を必須にする。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  computeDueInfo,
  daysBetween,
  defaultTemplateBody,
  dueBasisLine,
  dueBasisReason,
  formatDateWithWeekday,
  formatYearMonthJa,
  isRecordStaleForKoekake,
  latestVisitWithRecipe,
  menuNames,
  MESSAGES,
  renderKoekake,
  type ContactVia,
} from '../../domain'
import { recordContact, skipKoekake, type SkipOption } from '../../state/actions'
import { useApp, useSettings } from '../../state/AppState'
import { customerById, useEligibility, visitsOf } from '../../state/derived'
import { useFeedback } from '../../state/feedback'
import { navigate, to } from '../../state/router'
import { nowISO } from '../../state/today'
import { useDraft } from '../../state/useDraft'
import { Empty, StatusBadge, TopBar } from '../components/Basics'
import { MessageEditor, type MessageEditorHandle } from '../components/MessageEditor'
import { SendActions } from '../components/SendActions'
import { SkipSheet } from './SkipSheet'

export const STALE_KOEKAKE = '記録が止まっています。最近の来店が抜けていないか確かめてください'
export const MEMO_ONLY_NOTE = 'あなたが見るためだけのメモです。文面には入りません。'
export const STALE_DRAFT_NOTE = '前に書きかけた文面は、記録や設定が変わったため、今の内容で作り直しました。'

interface KoekakeDraft {
  /** 手直しした文面（null は差し込み済みの文面のまま） */
  text: string | null
  /** 手直しを始めたときの差し込み済みの文面 */
  base?: string
}

export function Koekake({ id, params }: { id: string; params: URLSearchParams }) {
  const app = useApp()
  const settings = useSettings()
  const { toast } = useFeedback()
  const elig = useEligibility()
  const { customers, visits, menus, templates, counters } = app.data
  const today = app.today
  const customer = customerById(customers, id)
  const fromCard = params.get('from') === 'card'
  const back = fromCard ? `#/customer/${encodeURIComponent(id)}` : '#/'
  const self = `#/koekake/${encodeURIComponent(id)}${fromCard ? '?from=card' : ''}`

  const due = useMemo(
    () => (customer ? (elig?.dueById.get(customer.id) ?? computeDueInfo(customer, visits, menus, settings, today)) : null),
    [customer, elig, visits, menus, settings, today],
  )
  const body = templates.find((t) => t.kind === 'koekake')?.body ?? defaultTemplateBody('koekake')
  const rendered = useMemo(
    () => (customer && due ? renderKoekake({ body, customer, due, menus, settings }) : null),
    [body, customer, due, menus, settings],
  )

  // 下書きには、書き始めたときの差し込み済みの文面（base）も残す。開き直したときに今の文面と違えば
  // （最終来店・経過・データの管理者・予約リンクなどが変わった）、古い事実の文面を送らないよう戻さない（0.3 #2・4.5・7.3）
  const staleDraft = useRef(false)
  const selfLink = settings.bookingLink.self
  const isSalonNow = customer?.stewardship.steward === 'salon'
  const draft = useDraft<KoekakeDraft>(`koekake:${id}`, () => ({ text: null }), (d) => {
    if (!d || typeof d !== 'object') return null
    const x = d as { text?: unknown; base?: unknown }
    if (typeof x.text !== 'string') return null
    const unsafe = isSalonNow && !!selfLink && x.text.includes(selfLink)
    if (typeof x.base !== 'string' || !rendered || x.base !== rendered.text || unsafe) {
      staleDraft.current = true
      return null
    }
    return { text: x.text, base: x.base }
  })
  const text = draft.value.text ?? rendered?.text ?? ''
  const editor = useRef<MessageEditorHandle>(null)
  const [acked, setAcked] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)

  // 使えなくなった下書きは端末からも消す
  useEffect(() => {
    if (draft.ready && staleDraft.current) void draft.clear()
  }, [draft.ready])

  // ［実は来ていた］から戻ったとき: 候補でなくなったらホームへ
  const checkedFix = useRef(false)
  useEffect(() => {
    if (checkedFix.current || params.get('fixed') !== '1' || !customer || !elig) return
    checkedFix.current = true
    const still = elig.candidates.some((c) => c.customer.id === customer.id)
    if (!still) {
      toast('リストから外れました')
      navigate('#/', { replace: true })
    } else {
      toast('来店を追加しました')
      navigate(self, { replace: true })
    }
  }, [params, customer, elig, toast, self])

  if (!customer || !due) {
    return (
      <main className="screen stack">
        <TopBar back={back} />
        <p className="muted">このお客様は見つかりませんでした。</p>
      </main>
    )
  }

  const isSalon = customer.stewardship.steward === 'salon'
  const L = due.lastVisit
  const ownVisits = visitsOf(visits, customer.id, today)
  const recipeVisit = latestVisitWithRecipe(ownVisits, today)
  const stale = counters ? isRecordStaleForKoekake(visits, counters, settings, today) : false
  const fixHref = to('/visit', { c: customer.id, src: 'fix', same: 1, focus: 'date', back: self, done: `${self}${fromCard ? '&' : '?'}fixed=1` })

  const onSent = async (via: ContactVia) => {
    if (saving.current) return
    saving.current = true
    setBusy(true)
    try {
      await app.mutate((repo) =>
        recordContact(repo, { customer, kind: 'koekake', via, stewardWarningAcked: isSalon ? acked : undefined, today, now: nowISO() }),
      )
      await draft.clear()
      toast(`${customer.nickname}さんに送った記録を残しました`)
      navigate(back)
    } catch {
      // 「送りましたか？」は画面に残すので、もう一度押せる
      toast(MESSAGES.saveFailed)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  const onSkip = async (option: SkipOption) => {
    // 二重に押しても見送りを2回数えない
    if (saving.current) return
    saving.current = true
    setBusy(true)
    try {
      await app.mutate((repo) => skipKoekake(repo, { customer, option, due, today, now: nowISO() }))
      setSkipOpen(false)
      await draft.clear()
      toast(option === 'no_contact' ? `${customer.nickname}さんを「連絡しない」にしました` : '今回は見送りました')
      navigate(back)
    } catch {
      toast(MESSAGES.saveFailed)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return (
    <main className="screen stack" aria-labelledby="koekake-title">
      <div className="stack-xs">
        <TopBar back={back} />
        <div className="candidate-head">
          <h1 className="name-lg" id="koekake-title">
            {customer.nickname}
          </h1>
          <StatusBadge status={due.status} />
        </div>
        {L && <p className="basis">{dueBasisLine(due, menus)}</p>}
        {L && <p className="meta">目安の根拠: {dueBasisReason(due, menus, settings)}</p>}
      </div>

      {!L ? (
        <Empty
          actions={
            <a className="btn btn-primary" href={to('/visit', { c: customer.id, back: self })}>
              来店を追加
            </a>
          }
        >
          最終来店が入っていないため、文面を作れません
        </Empty>
      ) : (
        <>
          <section className="card stack-xs" aria-labelledby="last-visit-title">
            <h2 className="label" id="last-visit-title">
              記録上の最終来店
            </h2>
            {L.dateApprox ? (
              <p className="metric-line">最終来店はおおよそ（{formatYearMonthJa(L.date)}）</p>
            ) : (
              <p className="metric-line">
                {/* 8.3 の表示: 「2026-08-22（土）・77日前・カット・白髪染め」 */}
                <strong>{formatDateWithWeekday(L.date)}</strong>・{daysBetween(L.date, today)}日前・{menuNames(L.menuIds, menus).join('・') || 'メニューなし'}
              </p>
            )}
            {stale && (
              <p className="alert" role="alert">
                {STALE_KOEKAKE}
              </p>
            )}
            <a className="btn btn-outline btn-block" href={fixHref} style={{ marginTop: 8 }}>
              実は来ていた → 来店を追加
            </a>
          </section>

          {(L.talkMemo || recipeVisit?.recipe?.text) && (
            <section className="stack-xs" aria-labelledby="memo-title">
              <h2 className="label" id="memo-title">
                前回のメモ
              </h2>
              <div className="memo-box stack-xs">
                {L.talkMemo && <p className="pre">会話: {L.talkMemo}</p>}
                {recipeVisit?.recipe?.text && <p className="pre">レシピ: {recipeVisit.recipe.text}</p>}
              </div>
              <p className="hint">{MEMO_ONLY_NOTE}</p>
            </section>
          )}

          {isSalon && !acked ? (
            <section className="card stack-sm" role="alert" aria-labelledby="salon-title">
              <h2 className="section-title" id="salon-title">
                所属サロンの顧客です
              </h2>
              <p>{MESSAGES.salonWarning}</p>
              <div className="stack-xs">
                <button type="button" className="btn btn-primary btn-block" onClick={() => setAcked(true)}>
                  認められているので続ける
                </button>
                <a className="btn btn-outline btn-block" href={back}>
                  やめる
                </a>
              </div>
            </section>
          ) : (
            <>
              <div className="stack-xs">
                <label className="label" htmlFor="koekake-text">
                  文面
                </label>
                <MessageEditor
                  ref={editor}
                  id="koekake-text"
                  label="文面"
                  value={text}
                  onChange={(v) => draft.set({ text: v, base: rendered?.text })}
                />
                {draft.ready && staleDraft.current && (
                  <p className="hint" role="status">
                    {STALE_DRAFT_NOTE}
                  </p>
                )}
                {draft.value.text !== null && rendered && draft.value.text !== rendered.text && (
                  <button type="button" className="linkish small" onClick={() => draft.set({ text: null })}>
                    最初の下書きに戻す
                  </button>
                )}
              </div>

              <p className="notice small">
                {customer.lineDisplayName
                  ? `LINEで『${customer.lineDisplayName}』を選んでください`
                  : '送り先を選ぶとき、呼び名と取り違えないように注意してください'}
              </p>

              <SendActions text={text} onSent={onSent} onCopyFailed={() => editor.current?.selectAll()} busy={busy} />
              <p className="hint">LINE公式アカウントや Instagram のDMでやりとりしている方には、コピーを使ってください。</p>
            </>
          )}

          <button type="button" className="btn btn-ghost btn-block" onClick={() => setSkipOpen(true)}>
            今回は見送る
          </button>
        </>
      )}

      {skipOpen && <SkipSheet onClose={() => setSkipOpen(false)} onPick={onSkip} busy={busy} />}
    </main>
  )
}

