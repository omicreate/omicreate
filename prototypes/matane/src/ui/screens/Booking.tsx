/**
 * S10 予約を入れる（仕様にない追加）。会計のあとで LINE・Instagram・電話で入った予約を、美容師が自分で手入力する。
 * 自動では取り込まない。日付の欄は貼り付け・入力・キーボードの音声入力を受け、日付だけを読む（時刻は捨てる）。
 * 貼った文そのものは保存しない（下書きにも残さない）。保存するのは日付だけ（customer.booking）。
 * - '#/booking'（客を選ぶところから）
 * - '#/booking?c=<顧客ID>&back=<戻る先>'（客を選んだ状態）
 */
import { useId, useMemo, useRef, useState } from 'react'
import {
  addDays,
  BOOKING_DATE_MESSAGES,
  BOOKING_MAX_DAYS,
  bookingDatePhrase,
  bookingMonthDay,
  bookingDateErrorMessage,
  bookingDateRangeError,
  effectiveOpenBooking,
  isValidISODate,
  MESSAGES,
  parseBookingDate,
  validateNickname,
} from '../../domain'
import { saveBooking } from '../../state/actions'
import { useApp } from '../../state/AppState'
import { customerById, recentCustomers, visitsOf } from '../../state/derived'
import { useFeedback } from '../../state/feedback'
import { navigate } from '../../state/router'
import { nowISO } from '../../state/today'
import { Field, TopBar } from '../components/Basics'
import { applyChannel, CustomerPicker, StewardFields, type NewCustomerValue } from '../components/Pickers'

export const BOOKING_TEXT = {
  title: '予約を入れる',
  textLabel: '予約日（貼り付け・入力・音声入力）',
  placeholder: '例: 20日の14時でお願いします！／来週火曜／明日',
  textHint: 'LINE などの文をそのまま貼ってもかまいません。日付だけを読み取ります。',
  privacy: '貼った文は保存しません。日付だけ残します',
  pickerLabel: 'カレンダーで確かめる・選ぶ',
  noDate: '予約日を入れてください',
} as const

export function Booking({ params }: { params: URLSearchParams }) {
  const app = useApp()
  const { toast, offerUndo } = useFeedback()
  const { customers, visits } = app.data
  const today = app.today
  const textId = useId()
  const readId = useId()
  const textRef = useRef<HTMLTextAreaElement>(null)

  const preset = customerById(customers, params.get('c'))
  const back = params.get('back') ?? (preset ? `#/customer/${encodeURIComponent(preset.id)}` : '#/')

  const [customerId, setCustomerId] = useState<string | undefined>(preset?.id)
  const [newCustomer, setNewCustomer] = useState<NewCustomerValue | undefined>(undefined)
  // 貼った文は画面の中だけに持つ（下書き・URL・保存のどこにも出さない）
  const [text, setText] = useState('')
  const [picked, setPicked] = useState('')
  const [errors, setErrors] = useState<{ customer?: string; nickname?: string; steward?: string; channel?: string; date?: string }>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const customer = customerById(customers, customerId)
  const recent = useMemo(() => recentCustomers(customers, visits, 5), [customers, visits])
  const current = useMemo(
    () => (customer ? effectiveOpenBooking(customer, visitsOf(visits, customer.id, today), today) : null),
    [customer, visits, today],
  )
  const parse = useMemo(() => parseBookingDate(text, today), [text, today])
  const maxDate = addDays(today, BOOKING_MAX_DAYS)
  const date = isValidISODate(picked) ? picked : null
  const rangeError = date ? bookingDateRangeError(date, today) : null

  const onText = (value: string) => {
    setText(value)
    const p = parseBookingDate(value, today)
    // 読み取れたら、すぐ下のカレンダーをその日付にする（カレンダーで上書きできる）。
    // 文があるのに読み取れなければ、前に読み取った日付を残さない（気づかずに古い日付で保存しないように）
    if (p.date) setPicked(p.date)
    else if (value.trim()) setPicked('')
  }

  const save = async () => {
    const e: typeof errors = {}
    if (!customer && !newCustomer) e.customer = 'お客様を選んでください'
    if (!customer && newCustomer) {
      const nk = validateNickname(newCustomer.nickname, customers)
      if (nk.error) e.nickname = nk.error
      if (!newCustomer.steward) e.steward = 'データの管理者を選んでください'
      if (!newCustomer.channel) e.channel = '獲得経路を選んでください'
    }
    if (!date) e.date = text.trim() ? BOOKING_DATE_MESSAGES.unreadable : BOOKING_TEXT.noDate
    else if (rangeError) e.date = bookingDateErrorMessage(rangeError) ?? undefined
    setErrors(e)
    setSaveError(null)
    if (Object.keys(e).length > 0 || !date) return
    setBusy(true)
    try {
      const repo = app.repo
      const res = await app.mutate((r) =>
        saveBooking(r, {
          customer,
          newCustomer:
            !customer && newCustomer?.steward && newCustomer.channel
              ? { nickname: newCustomer.nickname, steward: newCustomer.steward, channel: newCustomer.channel }
              : undefined,
          current: customer ? current : null,
          date,
          today,
          now: nowISO(),
        }),
      )
      setText('')
      const target = back
      navigate(target)
      if (repo) {
        offerUndo({
          message: `${res.customer.nickname}さんの予約を${bookingDatePhrase(date, today)}に入れました`,
          undo: res.undo,
          routeHash: target,
        })
      } else {
        toast('予約を入れました')
      }
    } catch {
      setSaveError(MESSAGES.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const readText = parse.date ? bookingDatePhrase(parse.date, today) : null
  const parseMessage =
    parse.error === 'unreadable'
      ? BOOKING_DATE_MESSAGES.unreadable
      : parse.error === 'past' || parse.error === 'too_far'
        ? bookingDateErrorMessage(parse.error)
        : null

  return (
    <main className="screen stack" aria-labelledby="booking-title">
      <div>
        <TopBar back={back} />
        <h1 className="title" id="booking-title">
          {BOOKING_TEXT.title}
        </h1>
      </div>

      <section aria-label="お客様">
        {customer ? (
          <div className="card-flat" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="grow">
              <p>
                <span className="label">お客様 </span>
                <strong style={{ fontSize: 'var(--fs-lg)' }}>{customer.nickname}</strong>
              </p>
              {current && (
                <p className="meta">
                  いまの予約 {bookingDatePhrase(current.date, today)}
                  {current.source === 'visit' ? '（会計時）' : ''}
                </p>
              )}
            </div>
            {!preset && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setCustomerId(undefined)}>
                変更
              </button>
            )}
          </div>
        ) : newCustomer ? (
          <div className="card-flat stack-sm">
            <div className="section-head" style={{ marginBottom: 0 }}>
              <h2 className="section-title">新しいお客様として登録</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewCustomer(undefined)}>
                やめる
              </button>
            </div>
            <Field label="呼び名" required error={errors.nickname} warning={validateNickname(newCustomer.nickname, customers).warning}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  className="input"
                  value={newCustomer.nickname}
                  autoComplete="off"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  onChange={(e) => setNewCustomer({ ...newCustomer, nickname: e.target.value })}
                />
              )}
            </Field>
            <StewardFields
              steward={newCustomer.steward}
              channel={newCustomer.channel}
              channelPlaceholder
              stewardError={errors.steward}
              channelError={errors.channel}
              onSteward={(s) => setNewCustomer({ ...newCustomer, steward: s, stewardAuto: false })}
              onChannel={(c) => setNewCustomer(applyChannel(newCustomer, c))}
            />
          </div>
        ) : (
          <div className="stack-sm">
            <CustomerPicker
              customers={customers}
              recent={recent}
              onPick={(c) => {
                setCustomerId(c.id)
                setNewCustomer(undefined)
                // 客を選んだら、すぐ日付の欄に入れるようにする（キーボードが開く）
                requestAnimationFrame(() => textRef.current?.focus())
              }}
              onNew={(nickname) => setNewCustomer({ nickname })}
            />
            {errors.customer && (
              <p className="error" role="alert">
                {errors.customer}
              </p>
            )}
          </div>
        )}
      </section>

      <div className="field">
        <label className="field-label" htmlFor={textId}>
          {BOOKING_TEXT.textLabel}
        </label>
        <textarea
          id={textId}
          ref={textRef}
          className="textarea"
          rows={2}
          style={{ minHeight: 64 }}
          value={text}
          autoComplete="off"
          placeholder={BOOKING_TEXT.placeholder}
          aria-describedby={readId}
          onChange={(e) => onText(e.target.value)}
        />
        <div id={readId} className="stack-xs" role="status" aria-live="polite">
          {(readText || parse.timeDropped) && (
            // 375px の画面でも、すぐ下のカレンダーが保存ボタンに隠れないよう1行にまとめる
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0 12px' }}>
              {readText && (
                <p className="metric-line">
                  読み取った日付 <strong>{readText}</strong>
                </p>
              )}
              {parse.timeDropped && <p className="hint">{BOOKING_DATE_MESSAGES.timeDropped}</p>}
            </div>
          )}
          {parse.multiple && <p className="warn">{BOOKING_DATE_MESSAGES.multiple}</p>}
          {parseMessage && <p className="warn">{parseMessage}</p>}
        </div>
      </div>

      <Field label={BOOKING_TEXT.pickerLabel} error={errors.date}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            className="input input-date"
            type="date"
            min={today}
            max={maxDate}
            value={picked}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onChange={(e) => setPicked(e.target.value)}
          />
        )}
      </Field>

      {date && !rangeError && current && current.date !== date && (
        <p className="warn" role="status">
          {bookingMonthDay(current.date, today)}の予約を{bookingMonthDay(date, today)}に変えます
        </p>
      )}

      <div className="stack-xs">
        <p className="hint">{BOOKING_TEXT.textHint}</p>
        <p className="hint">{BOOKING_TEXT.privacy}</p>
        <p className="hint">会計のあとで LINE・電話などで入った予約を、自分で入れておく欄です。</p>
      </div>

      {saveError && (
        <p className="alert" role="alert">
          {saveError}
        </p>
      )}

      <button type="button" className="btn btn-primary btn-block sticky-save" style={{ minHeight: 56 }} disabled={busy} onClick={() => void save()}>
        {current ? '予約日を保存' : '予約を保存'}
      </button>
    </main>
  )
}
