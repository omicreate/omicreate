/** バックアップから戻す: ファイルを選び、パスフレーズを入れる（4.9・7.4） */
import { useId, useState } from 'react'
import type { BackupPayload } from '../../domain'
import { decryptBackup } from '../../storage'

export function RestoreForm({ onPayload, submitLabel = 'バックアップから戻す' }: { onPayload: (p: BackupPayload) => Promise<void>; submitLabel?: string }) {
  const fileId = useId()
  const passId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [pass, setPass] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!file) {
      setError('バックアップのファイルを選んでください')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const text = await file.text()
      const res = await decryptBackup(text, pass)
      if (!res.ok) {
        setError(res.message)
        return
      }
      await onPayload(res.payload)
      setPass('')
    } catch {
      setError('戻せませんでした。もう一度お試しください')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="stack-sm"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className="field">
        <p className="field-label">バックアップのファイル</p>
        <div className="file-pick">
          <input
            id={fileId}
            type="file"
            accept=".json,application/json"
            aria-label="バックアップのファイルを選ぶ"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setError(null)
            }}
          />
          <label htmlFor={fileId} className="btn btn-outline">
            ファイルを選ぶ
          </label>
          <span className="meta">{file ? file.name : '選んでいません'}</span>
        </div>
      </div>
      <div className="field">
        <label className="field-label" htmlFor={passId}>
          パスフレーズ
        </label>
        <input
          id={passId}
          className="input"
          type="password"
          autoComplete="off"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
      </div>
      <p className="hint">今のデータは、戻す前の状態として1回分だけ残します。</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? '読み込んでいます…' : submitLabel}
      </button>
    </form>
  )
}
