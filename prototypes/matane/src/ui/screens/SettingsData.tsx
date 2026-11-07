/**
 * 設定 → データ（4.9・7.4）: 暗号化バックアップの書き出し・読み込み、戻す前の状態に戻す、平文の書き出し（警告つき）、
 * 永続保存、所属サロンの顧客をまとめて削除（確認2回）、すべて消す（確認2回）。
 */
import { useEffect, useState } from 'react'
import { localDateOf, MESSAGES } from '../../domain'
import {
  backupFileName,
  BackupError,
  discardSample,
  encryptBackup,
  exportPayload,
  markBackedUp,
  persistentStorageState,
  plainCsvExport,
  plainExportFileNames,
  plainJsonExport,
  requestPersistentStorage,
  restoreFromPayload,
  serializeBackupFile,
  undoRestore,
  validatePassphrase,
  wipeDatabase,
  PROD_DB,
  type PersistState,
} from '../../storage'
import { useApp, useSettings } from '../../state/AppState'
import { useFeedback } from '../../state/feedback'
import { downloadText } from '../../state/platform'
import { navigate } from '../../state/router'
import { nowISO } from '../../state/today'
import { Field } from '../components/Basics'
import { ConfirmTwice } from '../components/ConfirmTwice'
import { RestoreForm } from '../components/RestoreForm'
import { SectionPage } from './Settings'

export const DATA_OWNER_NOTE = '記録はこの端末の中だけにあります。作り手（omicreate）は受け取らず、消えたら戻せません。'
export const PASSPHRASE_ACK = 'パスフレーズを忘れると戻せないことを確認しました'
export const PLAIN_ACK = '暗号化されていないことを確認しました'

const PERSIST_LABEL: Record<PersistState, string> = {
  granted: '有効です（ブラウザが自動で消しにくくなっています）',
  not_granted: 'まだ有効になっていません',
  unsupported: 'この端末では確かめられません',
}

export function SettingsData() {
  const app = useApp()
  const settings = useSettings()
  const { toast } = useFeedback()
  const repo = app.repo
  const today = app.today

  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [ack, setAck] = useState(false)
  const [exportErr, setExportErr] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [plainAck, setPlainAck] = useState(false)
  const [restorePointAt, setRestorePointAt] = useState<string | null>(null)
  const [persist, setPersist] = useState<PersistState | null>(null)

  useEffect(() => {
    let alive = true
    repo
      ?.getRestorePoint()
      .then((rp) => alive && setRestorePointAt(rp?.createdAt ?? null))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [repo, app.data])

  useEffect(() => {
    void persistentStorageState().then(setPersist)
  }, [])

  const salonCount = app.data.customers.filter((c) => !c.deletedAt && c.stewardship.steward === 'salon').length

  const exportEncrypted = async () => {
    if (!repo) return
    const e = validatePassphrase(p1)
    if (e) {
      setExportErr(e)
      return
    }
    if (p1 !== p2) {
      setExportErr('パスフレーズが一致しません')
      return
    }
    setExportErr(null)
    setExporting(true)
    try {
      const payload = await exportPayload(repo, today)
      const file = await encryptBackup(payload, p1)
      downloadText(backupFileName(today), serializeBackupFile(file), 'application/json')
      await app.mutate((r) => markBackedUp(r, nowISO()))
      setP1('')
      setP2('')
      setAck(false)
      toast('バックアップを書き出しました')
    } catch (err) {
      setExportErr(err instanceof BackupError ? err.message : '書き出せませんでした。もう一度お試しください')
    } finally {
      setExporting(false)
    }
  }

  const exportPlain = async (kind: 'json' | 'csv') => {
    if (!repo) return
    const payload = await exportPayload(repo, today)
    const names = plainExportFileNames(today)
    if (kind === 'json') downloadText(names.json, plainJsonExport(payload), 'application/json')
    else downloadText(names.csv, plainCsvExport(payload), 'text/csv')
    toast('書き出しました')
  }

  return (
    <SectionPage title="データ">
      <div className="stack-xs">
        <p>{DATA_OWNER_NOTE}</p>
        <p className="metric-line">
          {settings.lastBackupAt ? `最後のバックアップ ${localDateOf(settings.lastBackupAt)}` : 'まだバックアップしていません'}
        </p>
      </div>

      <section className="card stack-sm" aria-labelledby="export-title">
        <h2 className="section-title" id="export-title">
          バックアップを書き出す（暗号化）
        </h2>
        <p className="muted small">パスフレーズで暗号化したファイルを、この端末に保存します。パスフレーズは保存しません。</p>
        <Field label="パスフレーズ（8文字以上）">
          {({ id }) => (
            <input id={id} className="input" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
          )}
        </Field>
        <Field label="もう一度">
          {({ id }) => (
            <input id={id} className="input" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
          )}
        </Field>
        <label className="check">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>{PASSPHRASE_ACK}</span>
        </label>
        {exportErr && (
          <p className="error" role="alert">
            {exportErr}
          </p>
        )}
        <button type="button" className="btn btn-primary btn-block" disabled={!ack || exporting} onClick={() => void exportEncrypted()}>
          {exporting ? '暗号化しています…' : 'バックアップを書き出す（暗号化）'}
        </button>
      </section>

      <section className="card stack-sm" aria-labelledby="restore-title">
        <h2 className="section-title" id="restore-title">
          バックアップから戻す
        </h2>
        {app.isSample && <p className="hint">サンプル表示中に戻すと、サンプルではなく本番用の記録に戻して切り替えます。</p>}
        <RestoreForm
          onPayload={async (payload) => {
            if (app.isSample) {
              // 本物のバックアップをサンプル用データベースに入れない（サンプルを消すと一緒に消えるため）
              await app.openDb(PROD_DB, (r) => restoreFromPayload(r, payload, nowISO()))
              navigate('#/', { replace: true })
            } else {
              await app.mutate((r) => restoreFromPayload(r, payload, nowISO()))
            }
            // 本番用の記録を戻したら永続保存を求める（4.1・7.4）
            void requestPersistentStorage()
            toast('バックアップから戻しました')
          }}
        />
        <div className="stack-xs">
          <button
            type="button"
            className="btn btn-outline btn-block"
            disabled={!restorePointAt}
            onClick={async () => {
              const ok = await app.mutate((r) => undoRestore(r))
              if (ok) {
                toast('戻す前の状態に戻しました')
                navigate('#/settings/data', { replace: true })
              }
            }}
          >
            戻す前の状態に戻す
          </button>
          <p className="hint">
            {restorePointAt ? `直前の1回分（${localDateOf(restorePointAt)}に戻す前の状態）` : '戻した記録はまだありません'}
          </p>
        </div>
      </section>

      <section className="card stack-sm" aria-labelledby="plain-title">
        <h2 className="section-title" id="plain-title">
          平文で書き出す（JSON／CSV）
        </h2>
        <p className="warn">{MESSAGES.plainExportWarning}</p>
        <p className="muted small">所属サロンの顧客とその記録は含めません。</p>
        <label className="check">
          <input type="checkbox" checked={plainAck} onChange={(e) => setPlainAck(e.target.checked)} />
          <span>{PLAIN_ACK}</span>
        </label>
        <div className="btn-pair">
          <button type="button" className="btn" disabled={!plainAck} onClick={() => void exportPlain('json')}>
            JSONで書き出す
          </button>
          <button type="button" className="btn" disabled={!plainAck} onClick={() => void exportPlain('csv')}>
            CSVで書き出す
          </button>
        </div>
      </section>

      <section className="card stack-sm" aria-labelledby="persist-title">
        <h2 className="section-title" id="persist-title">
          永続保存
        </h2>
        <p role="status">{persist ? PERSIST_LABEL[persist] : '確かめています…'}</p>
        <p className="muted small">ブラウザに「このサイトのデータを消さないで」と求めます。iPhone ではホーム画面に追加して使うと消えにくくなります。</p>
        <button
          type="button"
          className="btn btn-outline btn-block"
          disabled={persist === 'granted' || persist === 'unsupported'}
          onClick={async () => {
            setPersist(await requestPersistentStorage())
          }}
        >
          もう一度求める
        </button>
      </section>

      <section className="stack-sm" aria-labelledby="danger-title">
        <h2 className="section-title" id="danger-title">
          消す
        </h2>
        <ConfirmTwice
          label="所属サロンの顧客をまとめて削除"
          disabled={salonCount === 0}
          first={<p>所属サロンが管理者の顧客 {salonCount}人と、その来店・連絡の記録を消します。退店するときなどに使います。</p>}
          second={<p>元に戻せません。本当に消しますか？</p>}
          confirmLabel="消す"
          onConfirm={async () => {
            const n = await app.mutate((r) => r.deleteSalonCustomers())
            toast(`所属サロンの顧客 ${n}人を削除しました`)
          }}
        />
        <ConfirmTwice
          label="すべて消す"
          first={<p>この端末の{app.isSample ? 'サンプルの' : ''}記録をすべて消します。バックアップがあれば、消したあとに戻せます。</p>}
          second={<p>元に戻せません。本当にすべて消しますか？</p>}
          confirmLabel="すべて消す"
          onConfirm={async () => {
            if (!repo) return
            if (app.isSample) {
              // サンプルを消したら、空のサンプルではなく本番用を開く（「サンプル表示中」の帯が空の画面に残らないように）
              await app.openDb(PROD_DB, () => discardSample(repo))
              void requestPersistentStorage()
            } else {
              await wipeDatabase(repo)
              await app.openDb(app.dbName)
            }
            navigate('#/', { replace: true })
          }}
        />
      </section>
    </SectionPage>
  )
}
