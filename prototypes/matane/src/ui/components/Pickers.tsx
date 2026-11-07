/** 選ぶ部品: メニューのチップ、次回のチップ、客の検索、新しいお客様の欄、メモ欄 */
import { useId, useMemo, useState, type ReactNode } from 'react'
import {
  addDays,
  CHANNEL_LABELS,
  CHANNEL_ORDER,
  defaultStewardForChannel,
  detectHealthWords,
  HEALTH_WARNING,
  MESSAGES,
  nameStartsWith,
  NEXT_CHIPS,
  nextPlanLabel,
  STEWARD_LABELS,
  compareNames,
  type AcquisitionChannel,
  type Customer,
  type DataSteward,
  type ID,
  type ISODate,
  type Menu,
  type NextPlan,
} from '../../domain'
import { chipMenus } from '../../state/derived'
import { Chip, Segmented } from './Basics'

function sameIds(a: readonly ID[], b: readonly ID[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
}

/** メニューのチップ（複数選択）。previous があれば先頭に［前回と同じ］ */
export function MenuChips({
  label = 'メニュー',
  menus,
  selected,
  onChange,
  previous,
  error,
  labelHidden,
}: {
  label?: string
  menus: readonly Menu[]
  selected: readonly ID[]
  onChange: (ids: ID[]) => void
  previous?: readonly ID[]
  error?: string | null
  labelHidden?: boolean
}) {
  const id = useId()
  const list = chipMenus(menus, selected)
  const hasPrev = !!previous && previous.length > 0
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <p className={labelHidden ? 'visually-hidden' : 'field-label'} id={id}>
        {label}
      </p>
      <div className="chips">
        {hasPrev && (
          <Chip pressed={sameIds(previous!, selected)} onClick={() => onChange([...previous!])} soft>
            前回と同じ
          </Chip>
        )}
        {list.map((m) => {
          const on = selected.includes(m.id)
          return (
            <Chip key={m.id} pressed={on} onClick={() => onChange(on ? selected.filter((x) => x !== m.id) : [...selected, m.id])}>
              {m.name}
            </Chip>
          )
        })}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function sameNext(a: NextPlan, b: NextPlan): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'agreed' && b.kind === 'agreed') return a.amount === b.amount && a.unit === b.unit
  if (a.kind === 'booked' && b.kind === 'booked') return a.date === b.date
  return true
}

/** 次回: ［4週］［6週］［2か月］［3か月］［おまかせ］［予約日を入れる］。未選択でもよい */
export function NextChips({
  value,
  onChange,
  visitDate,
  error,
}: {
  value: NextPlan
  onChange: (n: NextPlan) => void
  visitDate: ISODate
  error?: string | null
}) {
  const id = useId()
  const dateId = useId()
  const custom = value.kind === 'agreed' && !NEXT_CHIPS.some((c) => sameNext(c.next, value))
  const booked = value.kind === 'booked'
  let minDate = ''
  try {
    minDate = addDays(visitDate, 1)
  } catch {
    minDate = ''
  }
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <p className="field-label" id={id}>
        次回
      </p>
      <div className="chips">
        {NEXT_CHIPS.map((c) => {
          const on = sameNext(c.next, value)
          return (
            <Chip key={c.label} pressed={on} onClick={() => onChange(on ? { kind: 'none' } : c.next)}>
              {c.label}
            </Chip>
          )
        })}
        {custom && (
          <Chip pressed onClick={() => onChange({ kind: 'none' })}>
            {nextPlanLabel(value)}
          </Chip>
        )}
        <Chip pressed={booked} onClick={() => onChange(booked ? { kind: 'none' } : { kind: 'booked', date: '' })}>
          予約日を入れる
        </Chip>
      </div>
      {booked && (
        <div className="field">
          <label className="field-label" htmlFor={dateId}>
            予約日
          </label>
          <input
            id={dateId}
            className="input input-date"
            type="date"
            min={minDate || undefined}
            value={value.kind === 'booked' ? value.date : ''}
            aria-invalid={!!error}
            onChange={(e) => onChange({ kind: 'booked', date: e.target.value })}
          />
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** 客を選ぶ: 「最近のお客様」5人と、呼び名・かなの前方一致検索 */
export function CustomerPicker({
  customers,
  recent,
  onPick,
  onNew,
  autoFocus,
  label = 'お客様',
}: {
  customers: readonly Customer[]
  recent: readonly Customer[]
  onPick: (c: Customer) => void
  /** 「新しいお客様として登録」（呼び名を引き継ぐ） */
  onNew?: (nickname: string) => void
  autoFocus?: boolean
  label?: string
}) {
  const id = useId()
  const [q, setQ] = useState('')
  const matches = useMemo(
    () =>
      q.trim()
        ? customers
            .filter((c) => !c.deletedAt && nameStartsWith(c.nickname, c.kana, q))
            .slice()
            .sort(compareNames)
            .slice(0, 12)
        : [],
    [customers, q],
  )
  const list = q.trim() ? matches : recent
  return (
    <div className="stack-sm">
      <div className="field">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        <input
          id={id}
          className="input"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="呼び名・かなで探す"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {list.length > 0 && (
        <div>
          {!q.trim() && <p className="label">最近のお客様</p>}
          <div className="chips" style={{ marginTop: 8 }}>
            {list.map((c) => (
              <button key={c.id} type="button" className="chip" onClick={() => onPick(c)}>
                {c.nickname}
              </button>
            ))}
          </div>
        </div>
      )}
      {q.trim() && matches.length === 0 && <p className="hint">見つかりませんでした</p>}
      {onNew && (customers.length === 0 || q.trim()) && (
        <button type="button" className="btn btn-outline btn-block" onClick={() => onNew(q.trim())}>
          新しいお客様として登録
        </button>
      )}
    </div>
  )
}

export interface NewCustomerValue {
  nickname: string
  steward?: DataSteward
  channel?: AcquisitionChannel
  /** 経路から自動で決めた管理者か */
  stewardAuto?: boolean
}

/** 経路を変えたときの管理者: サロン媒体・サロンからの引き継ぎなら所属サロン（4.7） */
export function applyChannel<T extends { steward?: DataSteward; channel?: AcquisitionChannel; stewardAuto?: boolean }>(
  v: T,
  channel: AcquisitionChannel,
): T {
  if (defaultStewardForChannel(channel) === 'salon') return { ...v, channel, steward: 'salon', stewardAuto: true }
  if (v.stewardAuto) return { ...v, channel, steward: undefined, stewardAuto: false }
  return { ...v, channel }
}

/** データの管理者（必須）と獲得経路 */
export function StewardFields({
  steward,
  channel,
  onSteward,
  onChannel,
  stewardError,
  channelError,
  channelPlaceholder,
}: {
  steward?: DataSteward
  channel?: AcquisitionChannel
  onSteward: (s: DataSteward) => void
  onChannel: (c: AcquisitionChannel) => void
  stewardError?: string | null
  channelError?: string | null
  /** 経路を「選んでください」から始める */
  channelPlaceholder?: boolean
}) {
  const channelId = useId()
  return (
    <div className="stack-sm">
      <div className="field">
        <Segmented<DataSteward>
          label="データの管理者（必須）"
          options={[
            { value: 'self', label: STEWARD_LABELS.self },
            { value: 'salon', label: STEWARD_LABELS.salon },
          ]}
          value={steward}
          onChange={onSteward}
        />
        {stewardError && (
          <p className="error" role="alert">
            {stewardError}
          </p>
        )}
      </div>
      <div className="field">
        <label className="field-label" htmlFor={channelId}>
          獲得経路
        </label>
        <select
          id={channelId}
          className="select"
          value={channel ?? ''}
          aria-invalid={!!channelError}
          onChange={(e) => onChannel(e.target.value as AcquisitionChannel)}
        >
          {(channelPlaceholder || !channel) && (
            <option value="" disabled>
              選んでください
            </option>
          )}
          {CHANNEL_ORDER.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
        {channelError && (
          <p className="error" role="alert">
            {channelError}
          </p>
        )}
        {steward === 'salon' && <p className="hint">所属サロンの顧客は、声かけ候補と平文の書き出しから外します。</p>}
      </div>
    </div>
  )
}

/** メモ欄: 下に常に注意を出し、健康に関する語が入ると注意する（6.13） */
export function MemoField({
  label,
  value,
  onChange,
  rows = 3,
  maxLength,
  extra,
  single,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  maxLength?: number
  extra?: ReactNode
  single?: boolean
}) {
  const id = useId()
  const noteId = `${id}-note`
  const warnId = `${id}-warn`
  const hits = detectHealthWords(value)
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {extra}
      {single ? (
        <input
          id={id}
          className="input"
          value={value}
          maxLength={maxLength}
          aria-describedby={`${noteId}${hits.length ? ` ${warnId}` : ''}`}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <textarea
          id={id}
          className="textarea"
          rows={rows}
          value={value}
          maxLength={maxLength}
          aria-describedby={`${noteId}${hits.length ? ` ${warnId}` : ''}`}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <p className="hint" id={noteId}>
        {MESSAGES.memoNote}
      </p>
      {hits.length > 0 && (
        <p className="warn" id={warnId} role="alert">
          {HEALTH_WARNING}
        </p>
      )}
    </div>
  )
}
