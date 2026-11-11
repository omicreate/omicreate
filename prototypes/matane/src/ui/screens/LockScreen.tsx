/** S9 ロック画面（4.11）。正しいPINで解除。5回続けて間違えると30秒入力できない。PINを忘れたら確認2回で全消去 */
import { useEffect, useRef, useState } from 'react'
import { INITIAL_PIN_ATTEMPTS, lockoutRemainingMs, MESSAGES, registerPinFailure } from '../../domain'
import { deleteDatabase, PROD_DB, SAMPLE_DB, verifyPin, wipeDatabase } from '../../storage'
import { useApp } from '../../state/AppState'
import { useLock } from '../../state/lock'
import { navigate } from '../../state/router'
import { ConfirmTwice } from '../components/ConfirmTwice'
import { NOT_ENCRYPTION } from './SettingsLock'

export const FORGOT_FIRST = 'PINを解除するには、この端末のデータをすべて消す必要があります。バックアップがあれば、消したあとに戻せます'

export function LockScreen() {
  const app = useApp()
  const lock = useLock()
  const pinLock = app.data.settings?.lock
  const [pin, setPin] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const input = useRef<HTMLInputElement>(null)
  const remaining = lockoutRemainingMs(lock.attempts, now)
  const waiting = remaining > 0
  // 保存してある間違いの回数を読み終えるまでは入力させない（開き直しで待ちを抜けられないように）
  const blocked = waiting || !lock.attemptsReady

  useEffect(() => {
    if (!waiting) return
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [waiting])

  useEffect(() => {
    if (!blocked) input.current?.focus()
  }, [blocked])

  const submit = async () => {
    if (!pinLock || busy || !lock.attemptsReady) return
    const t = Date.now()
    setNow(t)
    if (lockoutRemainingMs(lock.attempts, t) > 0) return
    setBusy(true)
    try {
      const ok = await verifyPin(pin, pinLock)
      if (ok) {
        lock.setAttempts(INITIAL_PIN_ATTEMPTS)
        setPin('')
        setErr(null)
        lock.unlock()
      } else {
        lock.setAttempts(registerPinFailure(lock.attempts, Date.now()))
        setNow(Date.now())
        setErr(MESSAGES.pinWrong)
        setPin('')
      }
    } finally {
      setBusy(false)
    }
  }

  const wipeAll = async () => {
    const repo = app.repo
    if (repo) await wipeDatabase(repo)
    const other = app.dbName === PROD_DB ? SAMPLE_DB : PROD_DB
    await deleteDatabase(other).catch(() => undefined)
    lock.setAttempts(INITIAL_PIN_ATTEMPTS)
    await app.openDb(PROD_DB)
    navigate('#/', { replace: true })
  }

  return (
    <div className="lock" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <div className="lock-inner stack">
        <div className="stack-xs" style={{ textAlign: 'center' }}>
          <img src="icon.svg" alt="" width={56} height={56} style={{ borderRadius: 14 }} />
          <h1 className="title" id="lock-title">
            またね帳
          </h1>
          <p className="muted">PINを入れてください</p>
        </div>
        <form
          className="stack-sm"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <label className="visually-hidden" htmlFor="lock-pin">
            PIN
          </label>
          <input
            id="lock-pin"
            ref={input}
            className="input pin-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            autoComplete="off"
            value={pin}
            disabled={blocked}
            aria-invalid={!!err}
            aria-describedby="lock-msg"
            onChange={(e) => setPin(e.target.value.replace(/[^0-9０-９]/g, ''))}
          />
          <div id="lock-msg" aria-live="polite">
            {waiting ? (
              <p className="error">間違いが5回続いたため、{Math.ceil(remaining / 1000)}秒入力できません</p>
            ) : (
              err && <p className="error">{err}</p>
            )}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={blocked || busy || pin.length < 4}>
            解除
          </button>
        </form>
        <p className="hint" style={{ textAlign: 'center' }}>
          {NOT_ENCRYPTION}
        </p>
        <ConfirmTwice
          label="PINを忘れた"
          buttonClass="btn btn-ghost btn-block"
          first={<p>{FORGOT_FIRST}</p>}
          second={<p>元に戻せません。この端末のデータをすべて消しますか？</p>}
          confirmLabel="すべて消す"
          onConfirm={wipeAll}
        />
      </div>
    </div>
  )
}
