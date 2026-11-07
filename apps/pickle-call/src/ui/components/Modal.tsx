// 使いやすいモーダル（ネイティブの <dialog>）。開くとフォーカスを中に閉じ込め、Esc で閉じ、閉じたら元の位置へ戻す。
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import './modal.css'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** 下に並べるボタン */
  actions?: ReactNode
}

export function Modal({ open, title, onClose, children, actions }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<Element | null>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      opener.current = document.activeElement
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
      const o = opener.current as HTMLElement | null
      o?.focus?.()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // 背景（dialog 自身）を押したら閉じる
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="modal-box">
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>
          <div className="modal-body">{children}</div>
          {actions && <div className="modal-actions">{actions}</div>}
        </div>
      )}
    </dialog>
  )
}
