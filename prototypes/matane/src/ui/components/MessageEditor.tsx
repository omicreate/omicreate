/**
 * 文面の欄。差し込めなかった語（不明な差し込み）を黄色で示す（4.5・6.10）。
 * テキストの後ろに同じ文字組みの層を置き、不明な差し込みの部分だけ黄色の地を付ける。
 */
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, Fragment } from 'react'
import { splitUnknownPlaceholders } from '../../domain'

export interface MessageEditorHandle {
  selectAll: () => void
  focus: () => void
}

export const MessageEditor = forwardRef<
  MessageEditorHandle,
  {
    id?: string
    label: string
    value: string
    onChange: (v: string) => void
    /** 差し込みとして正しい名前（それ以外の {…} を黄色にする） */
    knownNames?: readonly string[]
    describedBy?: string
  }
>(function MessageEditor({ id, label, value, onChange, knownNames = [], describedBy }, ref) {
  const ta = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => ({
    selectAll() {
      const el = ta.current
      if (!el) return
      el.focus()
      el.select()
      try {
        el.setSelectionRange(0, el.value.length)
      } catch {
        // 古いブラウザ
      }
    },
    focus() {
      ta.current?.focus()
    },
  }))

  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 140)}px`
  }, [value])

  const segments = splitUnknownPlaceholders(value, knownNames)
  const hasUnknown = segments.some((s) => s.unknown)

  return (
    <div className="stack-xs">
      <div className="hl">
        <div className="hl-backdrop" aria-hidden="true">
          {segments.map((s, i) => (s.unknown ? <mark key={i}>{s.text}</mark> : <Fragment key={i}>{s.text}</Fragment>))}
          {'\n'}
        </div>
        <textarea
          ref={ta}
          id={id}
          className="hl-textarea"
          aria-label={id ? undefined : label}
          aria-describedby={describedBy}
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {hasUnknown && (
        <p className="hint" role="note">
          <mark className="unknown">黄色</mark>の部分は差し込めませんでした。直してから送ってください。
        </p>
      )}
    </div>
  )
})
