// 設定。言語・表示・読み上げ・試合中・記録とプライバシー・このアプリについて。
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { RULESET } from '../../domain/rules/usap-2026'
import { numberWords } from '../../domain/speech-text'
import type { Lang } from '../../domain/types'
import type { T, TKey } from '../../i18n'
import { APP_VERSION, browserEnv, counterStatus } from '../../infra/counter'
import type { CounterStatus } from '../../infra/counter'
import { wakeLockSupported } from '../../infra/wakelock'
import { IconTrash, IconVolume } from '../components/Icons'
import { Modal } from '../components/Modal'
import { href } from '../router'
import { useApp } from '../store'
import type { Settings as AppSettings } from '../store'
import { ExtLink, PageHead } from './Home'
import './screens.css'

const SOURCE_URL = 'https://github.com/omicreate/omicreate/tree/main/apps/pickle-call'

const STATUS_KEY: Record<CounterStatus, TKey> = {
  on: 'settings.counterOn',
  'off-user': 'settings.counterOffUser',
  'off-dnt': 'settings.counterOffDnt',
  'off-config': 'settings.counterOffConfig',
  'off-site': 'settings.counterOffSite',
}

/** 匿名の回数を送っているかどうかの説明（設定とガイドで使う） */
export function counterStatusText(userOn: boolean, t: T): string {
  return t(STATUS_KEY[counterStatus(browserEnv(userOn))])
}

/** 試しに読む文。数字の読み方の設定に合わせる */
function sampleText(lang: Lang, numStyle: AppSettings['numStyle'], t: T): string {
  const style = lang === 'en' ? 'en' : numStyle
  const words = [4, 2, 1].map((n) => numberWords(n, style))
  const nums = lang === 'en' ? words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(', ') : words.join('、')
  return t('settings.sampleText', { nums })
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="st-sec" aria-labelledby={id}>
      <h2 className="st-sec-title" id={id}>
        {title}
      </h2>
      <div className="st-card">{children}</div>
    </section>
  )
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: string
  hint?: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="st-row">
      <label className="switch-row st-switch" htmlFor={id}>
        <span className="st-label">{label}</span>
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="switch"
          checked={checked}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
      {hint && (
        <div className="st-hint" id={`${id}-hint`}>
          {hint}
        </div>
      )}
    </div>
  )
}

function SegRow<V extends string>({
  id,
  label,
  value,
  options,
  onChange,
  column,
  hint,
}: {
  id: string
  label: string
  value: V
  options: [V, string, string?][]
  onChange: (v: V) => void
  column?: boolean
  hint?: string
}) {
  return (
    <div className="st-row" role="group" aria-labelledby={id}>
      <p className="st-label st-label-top" id={id}>
        {label}
      </p>
      <div className={`seg ${column ? 'st-seg-col' : ''}`}>
        {options.map(([v, text, langAttr]) => (
          <button key={v} type="button" lang={langAttr} aria-pressed={value === v} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
      {hint && <p className="st-hint st-hint-after">{hint}</p>}
    </div>
  )
}

export function Settings() {
  const { t, lang, settings, setSettings, speechOk, actions } = useApp()
  const [confirm, setConfirm] = useState(false)
  const [toast, setToast] = useState('')
  const wakeOk = useMemo(() => wakeLockSupported(), [])
  const status = counterStatus(browserEnv(settings.counter))

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(id)
  }, [toast])

  const rate = Math.round(settings.rate * 10) / 10
  const rateText = t('settings.rateValue', { n: rate.toFixed(1) })

  return (
    <main className="page st">
      <PageHead title={t('settings.title')} />

      <Section id="st-display" title={t('settings.secDisplay')}>
        <SegRow
          id="st-lang"
          label={t('settings.lang')}
          value={settings.lang}
          options={[
            ['ja', '日本語', 'ja'],
            ['en', 'English', 'en'],
          ]}
          onChange={(v) => setSettings({ lang: v })}
        />
        <SegRow
          id="st-theme"
          label={t('settings.theme')}
          value={settings.theme}
          options={[
            ['auto', t('settings.themeAuto')],
            ['light', t('settings.themeLight')],
            ['dark', t('settings.themeDark')],
          ]}
          hint={t('settings.themeHint')}
          onChange={(v) => setSettings({ theme: v })}
        />
        <SwitchRow
          id="st-contrast"
          label={t('settings.highContrast')}
          hint={t('settings.highContrastHint')}
          checked={settings.highContrast}
          onChange={(v) => setSettings({ highContrast: v })}
        />
      </Section>

      <Section id="st-voice" title={t('settings.secVoice')}>
        {!speechOk && (
          <div className="st-row">
            <p className="note">{t('common.voiceUnsupported')}</p>
          </div>
        )}
        <SwitchRow
          id="st-voice-on"
          label={t('settings.voice')}
          hint={t('settings.voiceHint')}
          checked={settings.voice}
          disabled={!speechOk}
          onChange={(v) => setSettings({ voice: v })}
        />
        <div className="st-row">
          <div className="st-rate-head">
            <label className="st-label" htmlFor="st-rate">
              {t('settings.rate')}
            </label>
            <span className="st-rate-value num" aria-hidden="true">
              {rateText}
            </span>
          </div>
          <input
            id="st-rate"
            className="st-range"
            type="range"
            min={0.8}
            max={1.2}
            step={0.1}
            value={rate}
            aria-valuetext={rateText}
            disabled={!speechOk || !settings.voice}
            onChange={(e) => setSettings({ rate: Math.round(Number(e.target.value) * 10) / 10 })}
          />
          <div className="st-range-ends xsmall muted" aria-hidden="true">
            <span>{t('settings.rateSlow')}</span>
            <span>{t('settings.rateFast')}</span>
          </div>
          <button
            type="button"
            className="btn st-try"
            disabled={!speechOk || !settings.voice}
            onClick={() => actions.speak(sampleText(lang, settings.numStyle, t))}
          >
            <IconVolume />
            {t('settings.try')}
          </button>
        </div>
        {lang === 'ja' && (
          <SegRow
            id="st-num"
            label={t('settings.numStyle')}
            value={settings.numStyle}
            column
            options={[
              ['kana', t('settings.numKana')],
              ['ja', t('settings.numJa')],
            ]}
            onChange={(v) => setSettings({ numStyle: v })}
          />
        )}
      </Section>

      <Section id="st-game" title={t('settings.secGame')}>
        <SwitchRow
          id="st-wake"
          label={t('settings.wakeLock')}
          hint={
            <>
              {t('settings.wakeLockHint')}
              {!wakeOk && <span className="st-hint-warn"> {t('settings.wakeLockNo')}</span>}
            </>
          }
          checked={settings.wakeLock}
          onChange={(v) => setSettings({ wakeLock: v })}
        />
      </Section>

      <Section id="st-data" title={t('settings.secData')}>
        <SwitchRow
          id="st-names"
          label={t('settings.keepNames')}
          hint={t('settings.keepNamesHint')}
          checked={settings.keepNames}
          onChange={(v) => setSettings({ keepNames: v })}
        />
        <SwitchRow
          id="st-counter"
          label={t('settings.counter')}
          hint={
            <>
              <span className="st-status" data-status={status} data-testid="counter-status">
                <span className="st-status-dot" aria-hidden="true" />
                {t(STATUS_KEY[status])}
              </span>
              <span className="st-hint-line">{t('settings.counterHint')}</span>
              <a className="st-hint-line" href={href('guide', { s: 'privacy' })}>
                {t('settings.privacyMore')}
              </a>
            </>
          }
          checked={settings.counter}
          onChange={(v) => setSettings({ counter: v })}
        />
        <div className="st-row">
          <p className="st-tip">
            <strong>{t('settings.homeTip')}</strong>
            <span className="st-hint-line">{t('settings.homeTipBody')}</span>
          </p>
        </div>
        <div className="st-row">
          <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirm(true)}>
            <IconTrash />
            {t('settings.clearAll')}
          </button>
        </div>
      </Section>

      <Section id="st-about" title={t('settings.secAbout')}>
        <dl className="st-dl">
          <div>
            <dt>{t('settings.version')}</dt>
            <dd className="num">{APP_VERSION}</dd>
          </div>
          <div>
            <dt>{t('settings.ruleset')}</dt>
            <dd>
              {RULESET.title[lang]} <span className="muted num">({RULESET.id})</span>
            </dd>
          </div>
          <div>
            <dt>{t('settings.checked')}</dt>
            <dd className="num">{RULESET.checkedAt}</dd>
          </div>
          <div>
            <dt>{t('settings.license')}</dt>
            <dd>{t('settings.licenseValue')}</dd>
          </div>
        </dl>
        <div className="st-row">
          <ExtLink href={SOURCE_URL} className="st-link">
            {t('settings.source')}
          </ExtLink>
          <p className="xsmall muted">{t('app.notOfficial')}</p>
        </div>
      </Section>

      <Modal
        open={confirm}
        title={t('settings.clearTitle')}
        onClose={() => setConfirm(false)}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                actions.clearAll()
                setConfirm(false)
                setToast(t('settings.cleared'))
              }}
            >
              {t('settings.clearOk')}
            </button>
          </>
        }
      >
        <p>{t('settings.clearBody')}</p>
      </Modal>

      <div role="status" className="sc-live">
        {toast && <p className="toast">{toast}</p>}
      </div>
    </main>
  )
}
