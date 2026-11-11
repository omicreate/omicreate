/** 小さな共通部品: 見出しの戻る、区分バッジ、空の状態、欄の枠、切り替え */
import { useId, type ReactNode } from 'react'
import { STATUS_LABELS, type TimingStatus } from '../../domain'
import { ChevronLeft } from './Icons'

export function TopBar({ back, backLabel = '戻る' }: { back: string; backLabel?: string }) {
  return (
    <nav className="topbar" aria-label="戻る">
      <a className="back" href={back}>
        <ChevronLeft />
        <span>{backLabel}</span>
      </a>
    </nav>
  )
}

export function StatusBadge({ status }: { status: TimingStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
}

export function Empty({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="empty">
      <div>{children}</div>
      {actions && <div className="btn-row">{actions}</div>}
    </div>
  )
}

export function SectionHead({ title, count, id, aside }: { title: string; count?: ReactNode; id?: string; aside?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 className="section-title" id={id}>
        {title}
        {count != null && <span className="section-count">（{count}）</span>}
      </h2>
      {aside}
    </div>
  )
}

/** ラベル・注意・エラーつきの欄。children に input などを渡し、id は render prop で受け取る */
export function Field({
  label,
  required,
  hint,
  error,
  warning,
  children,
}: {
  label: ReactNode
  required?: boolean
  hint?: ReactNode
  error?: string | null
  warning?: string | null
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const describedBy = [hint ? hintId : null, error || warning ? errId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            必須
          </span>
        )}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      {error ? (
        <p className="error" id={errId} role="alert">
          {error}
        </p>
      ) : warning ? (
        <p className="warn" id={errId}>
          {warning}
        </p>
      ) : null}
    </div>
  )
}

export interface SegOption<T extends string> {
  value: T
  label: string
}

/** 1つだけ選ぶ切り替え（radiogroup） */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  labelHidden,
}: {
  label: string
  options: ReadonlyArray<SegOption<T>>
  value: T | undefined
  onChange: (v: T) => void
  labelHidden?: boolean
}) {
  const id = useId()
  return (
    <div>
      <p className={labelHidden ? 'visually-hidden' : 'field-label'} id={id}>
        {label}
      </p>
      <div className="seg" role="radiogroup" aria-labelledby={id} style={labelHidden ? undefined : { marginTop: 8 }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className="seg-item"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** チップ（押すと切り替わる） */
export function Chip({
  pressed,
  onClick,
  children,
  soft,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
  soft?: boolean
}) {
  return (
    <button type="button" className={`chip${soft ? ' chip-soft' : ''}`} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  )
}
