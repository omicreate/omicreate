/**
 * S0 はじめに（初回だけ、4.1）と、［自分のお客様で始める］のあとの手順
 * （自分の名前 → 予約リンク → 使うメニュー → ざっくり登録）。途中で閉じても続きから始まる。
 */
import { useState } from 'react'
import { createDefaultMenus, MESSAGES, validateBookingLink, type Menu } from '../../domain'
import {
  acknowledgeNotice,
  loadSampleData,
  openRepositoryOrMemory,
  PROD_DB,
  requestPersistentStorage,
  restoreFromPayload,
  SAMPLE_DB,
} from '../../storage'
import { ONBOARDING_DRAFT, useApp, useSettings, type OnboardingStep } from '../../state/AppState'
import { navigate } from '../../state/router'
import { currentToday, nowISO } from '../../state/today'
import { Chip, Field } from '../components/Basics'
import { RestoreForm } from '../components/RestoreForm'

export const PROMISES = [
  '記録はこの端末の中だけに保存されます。',
  '作り手（omicreate）は記録を受け取らず、見ることもできません。消えたら作り手は戻せません。',
  '所属サロンから引き継いだ顧客や、サロンの集客で来た顧客のデータは所属サロンのものです。このアプリを違法な持ち出しや勧誘に使わないでください。所属先との契約（持ち出し禁止・非勧誘など）を確認してください。',
] as const

export const IPHONE_NOTE =
  'iPhone では、Safari の共有ボタンから「ホーム画面に追加」して使うと、データが消えにくくなります。'
export const SCREEN_LOCK_NOTE = '端末の画面ロック（パスコードや顔・指紋の認証）を必ず使ってください。'

export function Brand() {
  return (
    <div className="brand">
      <img src="icon.svg" alt="" width={44} height={44} />
      <h1 className="title">またね帳</h1>
    </div>
  )
}

export function Onboarding() {
  const app = useApp()
  const [read, setRead] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showRestore, setShowRestore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch {
      setError('うまく始められませんでした。もう一度お試しください')
      setBusy(false)
    }
  }

  const startSample = () =>
    run(async () => {
      await app.openDb(SAMPLE_DB, async (sample) => {
        const now = nowISO()
        // 確認した記録は本番用にも残す（サンプルを消したあと、本番用の空の状態から始められるように）
        const { repo: prod } = await openRepositoryOrMemory({ dbName: PROD_DB })
        try {
          await acknowledgeNotice(prod, now)
        } finally {
          prod.close()
        }
        await loadSampleData(sample, currentToday(), now)
      })
      navigate('#/', { replace: true })
    })

  const startOwn = () =>
    run(async () => {
      await app.openDb(PROD_DB, async (repo) => {
        await acknowledgeNotice(repo, nowISO())
        await repo.putDraft(ONBOARDING_DRAFT, { step: 'name' })
      })
      void requestPersistentStorage()
      navigate('#/', { replace: true })
    })

  return (
    <main className="screen screen-plain stack">
      <div className="stack-sm">
        <Brand />
        <p className="lead">会計で次回の目安を残すと、声をかけてもよさそうな人を数人だけ示す再来ノートです。</p>
      </div>

      <section className="card stack-sm" aria-labelledby="promise-title">
        <h2 className="section-title" id="promise-title">
          3つの約束
        </h2>
        <ol className="promises" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {PROMISES.map((p, i) => (
            <li key={i} className="promise">
              <span className="promise-num" aria-hidden="true">
                {i + 1}
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="stack-sm">
        <p className="notice">{MESSAGES.notCarte}</p>
        <p className="muted small">{IPHONE_NOTE}</p>
        <p className="muted small">{SCREEN_LOCK_NOTE}</p>
      </div>

      <div className="stack-sm">
        <label className="check">
          <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
          <span>読みました</span>
        </label>
        <button type="button" className="btn btn-primary btn-block" disabled={!read || busy} onClick={() => void startOwn()}>
          自分のお客様で始める
        </button>
        <button type="button" className="btn btn-outline btn-block" disabled={!read || busy} onClick={() => void startSample()}>
          サンプルで試す
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          className="toggle-more"
          aria-expanded={showRestore}
          disabled={!read}
          onClick={() => setShowRestore((v) => !v)}
        >
          バックアップから戻す
        </button>
        {showRestore && read && (
          <div className="card" style={{ marginTop: 8 }}>
            <RestoreForm
              onPayload={async (payload) => {
                await app.openDb(PROD_DB, async (repo) => {
                  await restoreFromPayload(repo, payload, nowISO())
                })
                // 本番で始めた時点で永続保存を求める（4.1）
                void requestPersistentStorage()
                navigate('#/', { replace: true })
              }}
            />
          </div>
        )}
      </div>
    </main>
  )
}

const STEPS: OnboardingStep[] = ['name', 'links', 'menus']

export function OnboardingWizard({ step }: { step: OnboardingStep }) {
  const app = useApp()
  const settings = useSettings()
  const [name, setName] = useState(settings.stylistName)
  const [self, setSelf] = useState(settings.bookingLink.self ?? '')
  const [salon, setSalon] = useState(settings.bookingLink.salon ?? '')
  const [linkErrors, setLinkErrors] = useState<{ self?: string | null; salon?: string | null }>({})
  const menus: Menu[] = app.data.menus.length ? app.data.menus : createDefaultMenus()
  const [visible, setVisible] = useState<string[]>(() => menus.filter((m) => m.visible).map((m) => m.id))
  const idx = STEPS.indexOf(step)

  const go = (s: OnboardingStep) => void app.setOnboarding(s)

  const saveName = async () => {
    await app.mutate((repo) => repo.updateSettings((s) => ({ ...s, stylistName: name.trim() })))
    go('links')
  }

  const saveLinks = async () => {
    const e = { self: validateBookingLink(self), salon: validateBookingLink(salon) }
    setLinkErrors(e)
    if (e.self || e.salon) return
    await app.mutate((repo) =>
      repo.updateSettings((s) => ({
        ...s,
        bookingLink: { ...(self.trim() ? { self: self.trim() } : {}), ...(salon.trim() ? { salon: salon.trim() } : {}) },
      })),
    )
    go('menus')
  }

  const finish = async () => {
    await app.mutate((repo) => repo.putMenus(menus.map((m) => ({ ...m, visible: visible.includes(m.id) }))))
    await app.setOnboarding(null)
    navigate('#/bulk', { replace: true })
  }

  return (
    <main className="screen screen-plain stack">
      <div className="steps" aria-label={`${idx + 1} / ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s} className={i <= idx ? 'on' : undefined} />
        ))}
      </div>

      {step === 'name' && (
        <section className="stack" aria-labelledby="ob-name">
          <div className="stack-xs">
            <h1 className="title" id="ob-name">
              自分の名前
            </h1>
            <p className="lead">文面の署名に使います。空のままでも始められます。</p>
          </div>
          <Field label="名前（任意）">
            {({ id }) => (
              <input id={id} className="input" value={name} autoComplete="off" onChange={(e) => setName(e.target.value)} />
            )}
          </Field>
          <button type="button" className="btn btn-primary btn-block" onClick={() => void saveName()}>
            次へ
          </button>
        </section>
      )}

      {step === 'links' && (
        <section className="stack" aria-labelledby="ob-links">
          <div className="stack-xs">
            <h1 className="title" id="ob-links">
              予約リンク
            </h1>
            <p className="lead">文面に入れる予約ページのURLです。どちらも任意です。</p>
          </div>
          <Field label="自分用" error={linkErrors.self} hint="https:// で始まるURL">
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                className="input"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://"
                value={self}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={(e) => setSelf(e.target.value)}
              />
            )}
          </Field>
          <Field label="所属サロン用" error={linkErrors.salon} hint="所属サロンの顧客の文面には、こちらだけを入れます">
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                className="input"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://"
                value={salon}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={(e) => setSalon(e.target.value)}
              />
            )}
          </Field>
          <div className="btn-pair">
            <button type="button" className="btn btn-outline" onClick={() => go('name')}>
              戻る
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void saveLinks()}>
              次へ
            </button>
          </div>
        </section>
      )}

      {step === 'menus' && (
        <section className="stack" aria-labelledby="ob-menus">
          <div className="stack-xs">
            <h1 className="title" id="ob-menus">
              使うメニュー
            </h1>
            <p className="lead">来店記録のチップに出すメニューです。あとで設定から変えられます。</p>
          </div>
          <div className="chips" role="group" aria-labelledby="ob-menus">
            {menus
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((m) => (
                <Chip
                  key={m.id}
                  pressed={visible.includes(m.id)}
                  onClick={() => setVisible((v) => (v.includes(m.id) ? v.filter((x) => x !== m.id) : [...v, m.id]))}
                >
                  {m.name}
                </Chip>
              ))}
          </div>
          <div className="btn-pair">
            <button type="button" className="btn btn-outline" onClick={() => go('links')}>
              戻る
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void finish()}>
              ざっくり登録へ
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
