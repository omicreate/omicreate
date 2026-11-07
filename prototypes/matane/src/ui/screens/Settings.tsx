/**
 * S8 設定とデータ（4.9）。項目ごとに小さな画面に分ける:
 * 自分のこと／メニューと目安の初期値／区分としきい値／文面／画面ロック／データ／サンプル／このアプリについて
 */
import { useState, type ReactNode } from 'react'
import {
  APP_VERSION,
  DEFAULT_MENUS,
  defaultTemplateBody,
  GLOBAL_DEFAULT_SOURCE,
  localDateOf,
  MESSAGES,
  newId,
  TEMPLATE_PLACEHOLDERS,
  validateBookingLink,
  type ContactKind,
  type Menu,
  type Settings as SettingsT,
} from '../../domain'
import { discardSample, loadSampleData, PROD_DB, requestPersistentStorage, SAMPLE_DB } from '../../storage'
import { useApp, useSettings } from '../../state/AppState'
import { useFeedback } from '../../state/feedback'
import { navigate } from '../../state/router'
import { nowISO } from '../../state/today'
import { useAutoSave } from '../../state/useAutoSave'
import { Field, TopBar } from '../components/Basics'
import { ChevronRight, DownIcon, UpIcon } from '../components/Icons'
import { MessageEditor } from '../components/MessageEditor'
import { PROMISES } from './Onboarding'
import { SettingsData } from './SettingsData'
import { SettingsLock } from './SettingsLock'

const SECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'me', label: '自分のこと' },
  { key: 'menus', label: 'メニューと目安の初期値' },
  { key: 'thresholds', label: '区分としきい値' },
  { key: 'templates', label: '文面' },
  { key: 'lock', label: '画面ロック' },
  { key: 'data', label: 'データ' },
  { key: 'sample', label: 'サンプル' },
  { key: 'about', label: 'このアプリについて' },
]

export function Settings({ section }: { section?: string }) {
  switch (section) {
    case 'me':
      return <MeSection />
    case 'menus':
      return <MenusSection />
    case 'thresholds':
      return <ThresholdsSection />
    case 'templates':
      return <TemplatesSection />
    case 'lock':
      return <SettingsLock />
    case 'data':
      return <SettingsData />
    case 'sample':
      return <SampleSection />
    case 'about':
      return <AboutSection />
    default:
      return <SettingsIndex />
  }
}

function SettingsIndex() {
  const settings = useSettings()
  return (
    <main className="screen stack" aria-labelledby="settings-title">
      <h1 className="title" id="settings-title">
        設定
      </h1>
      <ul className="list">
        {SECTIONS.map((s) => (
          <li key={s.key}>
            <a className="list-link" href={`#/settings/${s.key}`}>
              <span className="grow">
                {s.label}
                {s.key === 'data' && (
                  <span className="meta" style={{ display: 'block' }}>
                    {settings.lastBackupAt ? `最後のバックアップ ${localDateOf(settings.lastBackupAt)}` : 'まだバックアップしていません'}
                  </span>
                )}
                {s.key === 'lock' && (
                  <span className="meta" style={{ display: 'block' }}>
                    {settings.lock ? 'PINを使っています' : '使っていません'}
                  </span>
                )}
              </span>
              <ChevronRight />
            </a>
          </li>
        ))}
      </ul>
      <p className="muted small">{PROMISES[0]}作り手（omicreate）は記録を受け取りません。</p>
    </main>
  )
}

export function SectionPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="screen stack" aria-labelledby="section-title">
      <div>
        <TopBar back="#/settings" backLabel="設定" />
        <h1 className="title" id="section-title">
          {title}
        </h1>
      </div>
      {children}
    </main>
  )
}

/* ========== 自分のこと ========== */

function MeSection() {
  const app = useApp()
  const settings = useSettings()
  const [name, setName] = useState(settings.stylistName)
  const [self, setSelf] = useState(settings.bookingLink.self ?? '')
  const [salon, setSalon] = useState(settings.bookingLink.salon ?? '')
  const [saved, setSaved] = useState(false)
  const errSelf = validateBookingLink(self)
  const errSalon = validateBookingLink(salon)
  const saver = useAutoSave<{ name: string; self: string; salon: string }>(async (v) => {
    await app.mutate((repo) =>
      repo.updateSettings((s) => {
        const link: SettingsT['bookingLink'] = {}
        const okSelf = validateBookingLink(v.self) ? s.bookingLink.self : v.self.trim() || undefined
        const okSalon = validateBookingLink(v.salon) ? s.bookingLink.salon : v.salon.trim() || undefined
        if (okSelf) link.self = okSelf
        if (okSalon) link.salon = okSalon
        return { ...s, stylistName: v.name.trim(), bookingLink: link }
      }),
    )
    setSaved(true)
  })
  const update = (patch: Partial<{ name: string; self: string; salon: string }>) => {
    const v = { name, self, salon, ...patch }
    if (patch.name !== undefined) setName(patch.name)
    if (patch.self !== undefined) setSelf(patch.self)
    if (patch.salon !== undefined) setSalon(patch.salon)
    setSaved(false)
    saver.schedule(v)
  }
  return (
    <SectionPage title="自分のこと">
      <Field label="名前（文面の署名）">
        {({ id }) => <input id={id} className="input" value={name} autoComplete="off" onChange={(e) => update({ name: e.target.value })} />}
      </Field>
      <Field label="予約リンク（自分用）" error={errSelf} hint="https:// で始まるURL">
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
            onChange={(e) => update({ self: e.target.value })}
          />
        )}
      </Field>
      <Field label="予約リンク（所属サロン用）" error={errSalon} hint="所属サロンの顧客の文面には、こちらだけを入れます">
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
            onChange={(e) => update({ salon: e.target.value })}
          />
        )}
      </Field>
      <p className="hint" role="status">
        {saved ? '保存しました' : '入力すると自動で保存します'}
      </p>
    </SectionPage>
  )
}

/* ========== メニューと目安の初期値 ========== */

interface MenuRow {
  id: string
  name: string
  aliases: string
  days: string
  visible: boolean
  source?: Menu['source']
}

function toRows(menus: readonly Menu[]): MenuRow[] {
  return menus
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((m) => ({
      id: m.id,
      name: m.name,
      aliases: m.aliases.join('、'),
      days: m.defaultIntervalDays == null ? '' : String(m.defaultIntervalDays),
      visible: m.visible,
      source: m.source,
    }))
}

function parseDays(s: string): number | null | 'error' {
  const t = s.normalize('NFKC').trim()
  if (t === '') return null
  if (!/^\d+$/.test(t)) return 'error'
  const n = Number(t)
  return n >= 1 && n <= 730 ? n : 'error'
}

function MenusSection() {
  const app = useApp()
  const settings = useSettings()
  const [rows, setRows] = useState<MenuRow[]>(() => toRows(app.data.menus))
  const [global, setGlobal] = useState(String(settings.globalDefaultIntervalDays))
  const saver = useAutoSave<MenuRow[]>(async (list) => {
    const menus: Menu[] = []
    list.forEach((r, i) => {
      const days = parseDays(r.days)
      const orig = app.data.menus.find((m) => m.id === r.id)
      const m: Menu = {
        id: r.id,
        name: r.name.trim() || orig?.name || 'メニュー',
        aliases: r.aliases
          .split(/[、,，\s]+/)
          .map((a) => a.trim())
          .filter(Boolean),
        defaultIntervalDays: days === 'error' ? (orig?.defaultIntervalDays ?? null) : days,
        visible: r.visible,
        order: i + 1,
      }
      if (r.source) m.source = r.source
      menus.push(m)
    })
    await app.mutate((repo) => repo.putMenus(menus))
  })
  const globalSaver = useAutoSave<string>(async (v) => {
    const n = parseDays(v)
    if (typeof n !== 'number') return
    await app.mutate((repo) => repo.updateSettings((s) => ({ ...s, globalDefaultIntervalDays: n })))
  })
  const change = (next: MenuRow[]) => {
    setRows(next)
    saver.schedule(next)
  }
  const patch = (id: string, p: Partial<MenuRow>) => change(rows.map((r) => (r.id === id ? { ...r, ...p } : r)))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const next = rows.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    change(next)
  }
  const globalErr = typeof parseDays(global) === 'number' ? null : '1〜730の日数を入れてください'

  return (
    <SectionPage title="メニューと目安の初期値">
      <p className="muted small">目安の日数はすべて仮の値です。空にすると、そのメニューは目安に使いません。チップに出すかと並び順も変えられます。</p>
      <div className="stack-sm">
        {rows.map((r, i) => {
          const def = DEFAULT_MENUS.find((m) => m.id === r.id)
          const daysErr = parseDays(r.days) === 'error' ? '1〜730の日数を入れるか、空にしてください' : null
          return (
            <section key={r.id} className="card menu-edit" aria-label={r.name}>
              <div className="menu-edit-row">
                <label className="visually-hidden" htmlFor={`m-${r.id}-name`}>
                  メニュー名
                </label>
                <input id={`m-${r.id}-name`} className="input" value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} />
                <button type="button" className="icon-btn" aria-label={`${r.name}を上へ`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <UpIcon />
                </button>
                <button type="button" className="icon-btn" aria-label={`${r.name}を下へ`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                  <DownIcon />
                </button>
              </div>
              <div className="menu-edit-row">
                <label className="field-label" htmlFor={`m-${r.id}-days`} style={{ flex: 'none' }}>
                  目安
                </label>
                <input
                  id={`m-${r.id}-days`}
                  className="input input-num"
                  inputMode="numeric"
                  value={r.days}
                  placeholder="なし"
                  aria-invalid={!!daysErr}
                  onChange={(e) => patch(r.id, { days: e.target.value })}
                />
                <span className="muted">日</span>
                <label className="check" style={{ marginLeft: 'auto' }}>
                  <input type="checkbox" checked={r.visible} onChange={(e) => patch(r.id, { visible: e.target.checked })} />
                  <span className="small">チップに出す</span>
                </label>
              </div>
              {daysErr && <p className="error">{daysErr}</p>}
              <div className="field">
                <label className="field-label" htmlFor={`m-${r.id}-alias`}>
                  別名（1行入力用。「、」で区切る）
                </label>
                <input id={`m-${r.id}-alias`} className="input" value={r.aliases} onChange={(e) => patch(r.id, { aliases: e.target.value })} />
              </div>
              <p className="hint">
                {r.source ? `出典: ${r.source.label}（${r.source.asOf}時点）` : 'あなたが足したメニュー'}
                {def ? `・初期値 ${def.defaultIntervalDays == null ? 'なし' : `${def.defaultIntervalDays}日`}` : ''}
              </p>
            </section>
          )
        })}
      </div>
      <button
        type="button"
        className="btn btn-outline btn-block"
        onClick={() => change([...rows, { id: newId(), name: '新しいメニュー', aliases: '', days: '', visible: true }])}
      >
        ＋メニューを足す
      </button>
      <section className="card stack-xs" aria-labelledby="global-title">
        <h2 className="section-title" id="global-title">
          全体の目安
        </h2>
        <div className="menu-edit-row">
          <label className="visually-hidden" htmlFor="global-days">
            全体の目安（日）
          </label>
          <input
            id="global-days"
            className="input input-num"
            inputMode="numeric"
            value={global}
            aria-invalid={!!globalErr}
            onChange={(e) => {
              setGlobal(e.target.value)
              globalSaver.schedule(e.target.value)
            }}
          />
          <span className="muted">日</span>
        </div>
        {globalErr && <p className="error">{globalErr}</p>}
        <p className="hint">
          初期値 {GLOBAL_DEFAULT_SOURCE.days}日。{GLOBAL_DEFAULT_SOURCE.label}
        </p>
      </section>
    </SectionPage>
  )
}

/* ========== 区分としきい値 ========== */

type NumKey =
  | 'soonPct'
  | 'lapsedPct'
  | 'dormantDays'
  | 'cooldownDays'
  | 'maxContactsPerGap'
  | 'listLimit'
  | 'staleRecordDays'
  | 'backupReminderDays'
  | 'compareWindowDays'

const NUM_FIELDS: ReadonlyArray<{ key: NumKey; label: string; unit: string; min: number; max: number; hint?: string }> = [
  { key: 'soonPct', label: 'そろそろ（目安の間隔に対する割合）', unit: '%から', min: 1, max: 100 },
  { key: 'lapsedPct', label: '離れたかも（目安の間隔に対する割合）', unit: '%を超えたら', min: 101, max: 1000 },
  { key: 'dormantDays', label: '1年以上来ていない', unit: '日を超えたら', min: 30, max: 3650 },
  { key: 'cooldownDays', label: '声をかけたあと候補に出さない期間', unit: '日', min: 0, max: 365 },
  { key: 'maxContactsPerGap', label: '同じ空白期間の声かけ上限', unit: '回', min: 1, max: 10 },
  { key: 'listLimit', label: '候補の表示上限', unit: '人', min: 1, max: 50 },
  { key: 'staleRecordDays', label: '「記録が止まっています」を出す', unit: '日を超えたら', min: 1, max: 60 },
  { key: 'backupReminderDays', label: 'バックアップの催促', unit: '日を超えたら', min: 1, max: 180 },
  { key: 'compareWindowDays', label: 'ボードで声かけと戻りを比べる期間', unit: '日', min: 7, max: 365 },
]

function getNum(s: SettingsT, k: NumKey): number {
  if (k === 'soonPct' || k === 'lapsedPct' || k === 'dormantDays') return s.thresholds[k]
  return s[k]
}

function ThresholdsSection() {
  const app = useApp()
  const settings = useSettings()
  const [vals, setVals] = useState<Record<NumKey, string>>(
    () => Object.fromEntries(NUM_FIELDS.map((f) => [f.key, String(getNum(settings, f.key))])) as Record<NumKey, string>,
  )
  const errOf = (k: NumKey, v: string): string | null => {
    const f = NUM_FIELDS.find((x) => x.key === k)!
    const t = v.normalize('NFKC').trim()
    if (!/^\d+$/.test(t)) return `${f.min}〜${f.max}の数を入れてください`
    const n = Number(t)
    return n >= f.min && n <= f.max ? null : `${f.min}〜${f.max}の数を入れてください`
  }
  const saver = useAutoSave<Record<NumKey, string>>(async (v) => {
    await app.mutate((repo) =>
      repo.updateSettings((s) => {
        let next: SettingsT = { ...s, thresholds: { ...s.thresholds } }
        for (const f of NUM_FIELDS) {
          if (errOf(f.key, v[f.key])) continue
          const n = Number(v[f.key].normalize('NFKC').trim())
          if (f.key === 'soonPct' || f.key === 'lapsedPct' || f.key === 'dormantDays') next.thresholds[f.key] = n
          else next = { ...next, [f.key]: n }
        }
        return next
      }),
    )
  })
  return (
    <SectionPage title="区分としきい値">
      <p className="muted small">すべて仮の値です。根拠はなく、使いながら合わせてください。</p>
      {NUM_FIELDS.map((f) => {
        const err = errOf(f.key, vals[f.key])
        return (
          <Field key={f.key} label={f.label} error={err}>
            {({ id, describedBy, invalid }) => (
              <div className="menu-edit-row">
                <input
                  id={id}
                  className="input input-num"
                  inputMode="numeric"
                  value={vals[f.key]}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  onChange={(e) => {
                    const next = { ...vals, [f.key]: e.target.value }
                    setVals(next)
                    saver.schedule(next)
                  }}
                />
                <span className="muted">{f.unit}</span>
              </div>
            )}
          </Field>
        )
      })}
      <label className="check">
        <input
          type="checkbox"
          checked={settings.onlyContactOkInList}
          onChange={(e) => {
            const v = e.target.checked
            void app.mutate((repo) => repo.updateSettings((s) => ({ ...s, onlyContactOkInList: v })))
          }}
        />
        <span>連絡OKの人だけを候補にする</span>
      </label>
    </SectionPage>
  )
}

/* ========== 文面 ========== */

function TemplatesSection() {
  return (
    <SectionPage title="文面">
      <p className="muted small">割引やクーポンの言葉は入れていません。会話メモ・レシピメモは文面に入りません。</p>
      <TemplateEditor kind="koekake" title="声かけ" />
      <TemplateEditor kind="matane" title="またねカード" />
    </SectionPage>
  )
}

function TemplateEditor({ kind, title }: { kind: ContactKind; title: string }) {
  const app = useApp()
  const current = app.data.templates.find((t) => t.kind === kind)?.body ?? defaultTemplateBody(kind)
  const [body, setBody] = useState(current)
  const saver = useAutoSave<string>(async (v) => {
    await app.mutate((repo) => repo.putTemplate({ kind, body: v, isDefault: v === defaultTemplateBody(kind), updatedAt: nowISO() }))
  })
  const id = `tpl-${kind}`
  return (
    <div className="stack-xs">
      <h2 className="section-title">
        <label htmlFor={id}>{title}</label>
      </h2>
      <MessageEditor
        id={id}
        label={title}
        value={body}
        knownNames={TEMPLATE_PLACEHOLDERS[kind]}
        onChange={(v) => {
          setBody(v)
          saver.schedule(v)
        }}
      />
      <p className="hint">
        差し込み: {TEMPLATE_PLACEHOLDERS[kind].map((p) => `{${p}}`).join(' ')}。中身が空の差し込みを含む行は消えます。
      </p>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={body === defaultTemplateBody(kind)}
        onClick={() => {
          const v = defaultTemplateBody(kind)
          setBody(v)
          saver.schedule(v)
        }}
      >
        初期の文面に戻す
      </button>
    </div>
  )
}

/* ========== サンプル ========== */

function SampleSection() {
  const app = useApp()
  const { toast } = useFeedback()
  const [busy, setBusy] = useState(false)
  return (
    <SectionPage title="サンプル">
      <p className="muted">
        サンプルは架空の10人です（植物の名前）。本番の記録とは別の場所に入れ、混ぜません。
      </p>
      {app.isSample ? (
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await app.openDb(PROD_DB, async () => {
                await discardSample(app.repo)
              })
              // 本番で始めた時点で永続保存を求める（4.1）
              void requestPersistentStorage()
              toast('サンプルを消しました')
              navigate('#/', { replace: true })
            } finally {
              setBusy(false)
            }
          }}
        >
          サンプルを消して自分のお客様で始める
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await app.openDb(SAMPLE_DB, (repo) => loadSampleData(repo, app.today, nowISO()))
              navigate('#/', { replace: true })
            } finally {
              setBusy(false)
            }
          }}
        >
          サンプルで試す
        </button>
      )}
      {!app.isSample && <p className="hint">サンプルを開いているあいだ、あなたの記録は表示されません。消さずに残ります。</p>}
    </SectionPage>
  )
}

/* ========== このアプリについて ========== */

const SOURCES: ReadonlyArray<string> = [
  '顧客数の減少が美容業の経営上の問題点の1位（日本政策金融公庫、2026年4-6月。事実）',
  '女性の年間利用回数4.18回（美容センサス2026上期。事実）→ 全体の目安 約87日（換算。推定）',
  'メニュー別の来店目安（DEMI 2024-07、QJ 2026-04更新の記事。記事の記載として事実。個々の客に当てはまるかは未検証）',
  '退店時の顧客情報の持ち出しをめぐる相談（弁護士ドットコム。相談があることは事実、法的な結論は未検証）',
  '個人美容師の信頼できる基準値はない（だから先月の自分とだけ比べる）',
]

function AboutSection() {
  return (
    <SectionPage title="このアプリについて">
      <section className="stack-xs" aria-labelledby="owner-title">
        <h2 className="section-title" id="owner-title">
          データの持ち主
        </h2>
        <p>
          記録の持ち主は、使っているあなたです。ただし「所属サロン」を管理者にした顧客のデータは、所属サロンのものとして扱います。お客様の個人情報を扱う事業者はあなた（または所属サロン）で、このアプリはその道具です。
        </p>
        <p>{PROMISES[2]}</p>
      </section>
      <section className="stack-xs" aria-labelledby="maker-title">
        <h2 className="section-title" id="maker-title">
          作り手は記録を受け取りません
        </h2>
        <p>
          記録はこの端末の中だけにあります。サーバー・解析ツール・Cookie はなく、アプリから外へは何も送りません。外とのやりとりは、あなたが押す「コピー」「LINEで送る」と、ファイルの書き出し・読み込みだけです。消えたら作り手は戻せません。
        </p>
        <p className="muted small">{MESSAGES.notCarte}</p>
      </section>
      <section className="stack-xs" aria-labelledby="caution-title">
        <h2 className="section-title" id="caution-title">
          ご注意
        </h2>
        <ul className="muted small" style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>1台を複数の人で使うことは想定していません。</li>
          <li>アプリの切り替え画面やスクリーンショットに内容が写ることは、このアプリからは防げません。</li>
          <li>端末をなくしたとき、アプリから遠隔で消す手段はありません。端末を探す機能・遠隔消去を使ってください。</li>
        </ul>
      </section>
      <section className="stack-xs" aria-labelledby="sources-title">
        <h2 className="section-title" id="sources-title">
          出典
        </h2>
        <ul className="muted small" style={{ margin: 0, paddingLeft: '1.2em' }}>
          {SOURCES.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
      <p className="faint small">版 {APP_VERSION}</p>
    </SectionPage>
  )
}
