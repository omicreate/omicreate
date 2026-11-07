/** 取り返しのつかない操作の「確認2回」（所属サロンの顧客をまとめて削除・すべて消す・PINを忘れた） */
import { useState, type ReactNode } from 'react'
import { Sheet } from './Sheet'

export function ConfirmTwice({
  label,
  first,
  second,
  confirmLabel,
  onConfirm,
  disabled,
  buttonClass = 'btn btn-danger btn-block',
}: {
  /** ボタンの文言 */
  label: string
  /** 1回目の確認の文 */
  first: ReactNode
  /** 2回目の確認の文 */
  second: ReactNode
  /** 最後に押すボタンの文言 */
  confirmLabel: string
  onConfirm: () => Promise<void> | void
  disabled?: boolean
  buttonClass?: string
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [busy, setBusy] = useState(false)
  const close = () => {
    if (!busy) setStep(0)
  }
  return (
    <>
      <button type="button" className={buttonClass} disabled={disabled} onClick={() => setStep(1)}>
        {label}
      </button>
      {step === 1 && (
        <Sheet title={label} onClose={close} role="alertdialog">
          <div className="stack-sm">
            <div>{first}</div>
            <div className="btn-pair">
              <button type="button" className="btn btn-outline" onClick={close}>
                やめる
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setStep(2)}>
                続ける
              </button>
            </div>
          </div>
        </Sheet>
      )}
      {step === 2 && (
        <Sheet title="もう一度確かめます" onClose={close} role="alertdialog">
          <div className="stack-sm">
            <div>{second}</div>
            <div className="btn-pair">
              <button type="button" className="btn btn-outline" onClick={close} disabled={busy}>
                やめる
              </button>
              <button
                type="button"
                className="btn btn-danger-solid"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await onConfirm()
                  } finally {
                    setBusy(false)
                    setStep(0)
                  }
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  )
}
