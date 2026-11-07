/** 下から出るシート（モーダル）。Esc と背景のタップで閉じる。開いたら中の最初の部品にフォーカスを移す */
import { useEffect, useId, useRef, type ReactNode } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export function Sheet({
  title,
  onClose,
  children,
  dismissible = true,
  role = 'dialog',
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  dismissible?: boolean
  role?: 'dialog' | 'alertdialog'
}) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    // 入力欄に直接フォーカスするとスマホのキーボードが開くので、シートそのものにフォーカスする
    el?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation()
        onCloseRef.current()
      }
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)]
        if (items.length === 0) return
        const firstEl = items[0]
        const lastEl = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (prev && document.contains(prev)) prev.focus()
    }
  }, [dismissible])

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role={role} aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="sheet-grip" aria-hidden="true" />
        <h2 className="sheet-title" id={titleId}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
