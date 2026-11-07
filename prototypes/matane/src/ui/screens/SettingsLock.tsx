/** 設定 → 画面ロック（4.9・7.4）: PIN の設定・変更・解除、自動ロックまでの時間 */
import { useState } from 'react'
import { DEFAULT_AUTO_LOCK_MINUTES } from '../../domain'
import { createPinLock, validatePin, verifyPin } from '../../storage'
import { useApp, useSettings } from '../../state/AppState'
import { useFeedback } from '../../state/feedback'
import { useLock } from '../../state/lock'
import { Field } from '../components/Basics'
import { SCREEN_LOCK_NOTE } from './Onboarding'
import { SectionPage } from './Settings'

export const NOT_ENCRYPTION = 'これは覗き見防止で、データの暗号化ではありません'
export const FORGOT_NOTE = 'PINを忘れたら、この端末のデータをすべて消すしかありません。バックアップを書き出しておいてください。'
const MINUTES = [1, 3, 5, 10, 15] as const

function PinInput({ label, value, onChange, autoComplete = 'off' }: { label: string; value: string; onChange: (v: string) => void; autoComplete?: string }) {
  return (
    <Field label={label}>
      {({ id }) => (
        <input
          id={id}
          className="input pin-input"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9０-９]/g, ''))}
        />
      )}
    </Field>
  )
}

export function SettingsLock() {
  const app = useApp()
  const settings = useSettings()
  const { toast } = useFeedback()
  const lock = useLock()
  const [cur, setCur] = useState('')
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [minutes, setMinutes] = useState<number>(settings.lock?.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'idle' | 'change' | 'remove'>('idle')

  const reset = () => {
    setCur('')
    setP1('')
    setP2('')
    setErr(null)
    setMode('idle')
  }

  const setPin = async (requireCurrent: boolean) => {
    const e = validatePin(p1)
    if (e) return setErr(e)
    if (p1 !== p2) return setErr('PINが一致しません')
    setBusy(true)
    try {
      if (requireCurrent && settings.lock && !(await verifyPin(cur, settings.lock))) return setErr('今のPINが違います')
      const pinLock = await createPinLock(p1, { autoLockMinutes: minutes })
      await app.mutate((repo) => repo.updateSettings((s) => ({ ...s, lock: pinLock })))
      reset()
      toast(requireCurrent ? 'PINを変えました' : 'PINを設定しました')
    } finally {
      setBusy(false)
    }
  }

  const removePin = async () => {
    if (!settings.lock) return
    setBusy(true)
    try {
      if (!(await verifyPin(cur, settings.lock))) return setErr('今のPINが違います')
      await app.mutate((repo) =>
        repo.updateSettings((s) => {
          const next = { ...s }
          delete next.lock
          return next
        }),
      )
      reset()
      toast('PINを解除しました')
    } finally {
      setBusy(false)
    }
  }

  const saveMinutes = async (m: number) => {
    setMinutes(m)
    if (settings.lock) {
      await app.mutate((repo) => repo.updateSettings((s) => (s.lock ? { ...s, lock: { ...s.lock, autoLockMinutes: m } } : s)))
    }
  }

  return (
    <SectionPage title="画面ロック">
      <div className="stack-xs">
        <p className="notice">{NOT_ENCRYPTION}</p>
        <p className="muted small">
          PINを設定すると、{minutes}分操作がないとき、またはアプリを離れて1分以上たって戻ったときにロックします。
        </p>
        <p className="muted small">{SCREEN_LOCK_NOTE}</p>
        <p className="muted small">{FORGOT_NOTE}</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="auto-lock">
          自動ロックまでの時間
        </label>
        <select id="auto-lock" className="select" style={{ maxWidth: 200 }} value={minutes} onChange={(e) => void saveMinutes(Number(e.target.value))}>
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}分
            </option>
          ))}
        </select>
      </div>

      {!settings.lock ? (
        <section className="card stack-sm" aria-labelledby="pin-set-title">
          <h2 className="section-title" id="pin-set-title">
            PINを設定する（4〜8桁の数字）
          </h2>
          <PinInput label="PIN" value={p1} onChange={setP1} autoComplete="new-password" />
          <PinInput label="もう一度" value={p2} onChange={setP2} autoComplete="new-password" />
          {err && (
            <p className="error" role="alert">
              {err}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => void setPin(false)}>
            PINを設定する
          </button>
        </section>
      ) : (
        <section className="stack-sm" aria-label="PINの管理">
          <p className="metric-line">PINを使っています</p>
          {mode === 'idle' && (
            <div className="stack-sm">
              <button type="button" className="btn btn-block" onClick={() => lock.lockNow()}>
                今すぐロックする
              </button>
              <div className="btn-pair">
                <button type="button" className="btn btn-outline" onClick={() => setMode('change')}>
                  PINを変える
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setMode('remove')}>
                  PINを解除する
                </button>
              </div>
            </div>
          )}
          {mode !== 'idle' && (
            <div className="card stack-sm">
              <PinInput label="今のPIN" value={cur} onChange={setCur} />
              {mode === 'change' && (
                <>
                  <PinInput label="新しいPIN" value={p1} onChange={setP1} autoComplete="new-password" />
                  <PinInput label="もう一度" value={p2} onChange={setP2} autoComplete="new-password" />
                </>
              )}
              {err && (
                <p className="error" role="alert">
                  {err}
                </p>
              )}
              <div className="btn-pair">
                <button type="button" className="btn btn-outline" onClick={reset}>
                  やめる
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void (mode === 'change' ? setPin(true) : removePin())}
                >
                  {mode === 'change' ? '変える' : '解除する'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </SectionPage>
  )
}
