// 数え方とルール。スコア係がつまずく10の要点を、自分の言葉と条番号で。出典・注記・プライバシーも置く。
// 条文は転載しない（ルールブックに無断転載禁止の表示がある）。条の見出しは RULESET.refs から引く。
import { useEffect } from 'react'
import { RULESET } from '../../domain/rules/usap-2026'
import type { Lang } from '../../domain/types'
import type { TKey } from '../../i18n'
import { parseHash } from '../router'
import { useApp } from '../store'
import { CallAnatomy, ExtLink, PageHead } from './Home'
import { counterStatusText } from './Settings'
import './screens.css'

interface Point {
  n: number
  refs: string[]
}

/** 10の要点と条番号（2026年版） */
const POINTS: Point[] = [
  { n: 1, refs: ['6.B.2'] },
  { n: 2, refs: ['5.B', '5.B.2'] },
  { n: 3, refs: ['4.A'] },
  { n: 4, refs: ['5.B.3'] },
  { n: 5, refs: ['5.B.2', '5.B.5', '5.B.6'] },
  { n: 6, refs: ['5.A.1', '5.A.2', '5.A.3', '6.B.1'] },
  { n: 7, refs: ['14.A.2', '14.A.3', '14.A.4', '14.A.5', 'CD-2242'] },
  { n: 8, refs: ['4.B', 'CH-1', '15.C'] },
  { n: 9, refs: ['21.B.1', '21.B.2', '21.B.3', '21.B.4'] },
  { n: 10, refs: ['6.D'] },
]

const PRIVACY_ITEMS: TKey[] = [
  'guide.privacyItemApp',
  'guide.privacyItemEvent',
  'guide.privacyItemFormat',
  'guide.privacyItemVersion',
  'guide.privacyItemSrc',
  'guide.privacyItemPwa',
]

/** 条番号の表示。CD-2242 は 2026年の変更点（Change Document）、CH-1 は第1章 */
function RefItem({ id, lang }: { id: string; lang: Lang }) {
  const { t } = useApp()
  if (id === 'CH-1') {
    return (
      <li className="gd-ref">
        <span className="gd-ref-no">{t('guide.ch1')}</span>
      </li>
    )
  }
  const title = RULESET.refs[id]?.[lang] ?? ''
  if (id.startsWith('CD-')) {
    return (
      <li className="gd-ref">
        <span className="gd-ref-no num">{id.slice(3)}</span>
        <span className="gd-ref-title">{title}</span>
      </li>
    )
  }
  return (
    <li className="gd-ref">
      <span className="gd-ref-no num">{id}</span>
      {title && <span className="gd-ref-title">{title}</span>}
    </li>
  )
}

/** 偶数なら右・奇数なら左の小さな図（要点4・6） */
function ParityDiagram() {
  const { t } = useApp()
  return (
    <div className="gd-parity" aria-hidden="true">
      <div className="gd-parity-cell">
        <span className="gd-parity-n num">0 · 2 · 4</span>
        <span className="gd-parity-box">
          <span className="gd-slot" />
          <span className="gd-slot">
            <span className="gd-chip">S</span>
          </span>
        </span>
        <span className="gd-parity-side">{t('common.right')}</span>
      </div>
      <div className="gd-parity-cell">
        <span className="gd-parity-n num">1 · 3 · 5</span>
        <span className="gd-parity-box">
          <span className="gd-slot">
            <span className="gd-chip">S</span>
          </span>
          <span className="gd-slot" />
        </span>
        <span className="gd-parity-side">{t('common.left')}</span>
      </div>
    </div>
  )
}

export function Guide() {
  const { t, lang, settings } = useApp()

  // 設定画面の「送る中身をくわしく見る」から来たら、プライバシーの節を見せる
  useEffect(() => {
    if (parseHash(location.hash).query.get('s') !== 'privacy') return
    const el = document.getElementById('privacy')
    if (!el) return
    const id = window.setTimeout(() => {
      el.scrollIntoView({ block: 'start' })
      el.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <main className="page gd">
      <PageHead title={t('guide.title')} />
      <p className="gd-lead">{t('guide.lead')}</p>

      <ol className="gd-points">
        {POINTS.map((p) => (
          <li key={p.n} className="gd-point">
            <span className="gd-point-n num" aria-hidden="true">
              {String(p.n).padStart(2, '0')}
            </span>
            <div className="gd-point-body">
              <h2 className="gd-point-title" id={`gd-p${p.n}`}>
                {t(`guide.p${p.n}.title` as TKey)}
              </h2>
              {p.n === 1 && <CallAnatomy size="md" />}
              <p>{t(`guide.p${p.n}.body` as TKey)}</p>
              {p.n === 4 && <ParityDiagram />}
              <ul className="gd-refs" aria-label={t('guide.refs')}>
                {p.refs.map((r) => (
                  <RefItem key={r} id={r} lang={lang} />
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      <section className="gd-sec" aria-labelledby="gd-notes">
        <h2 className="gd-sec-title" id="gd-notes">
          {t('guide.notes')}
        </h2>
        <ul className="gd-notes">
          <li>{t('guide.noteSummary')}</li>
          <li>{t('guide.noteReferee')}</li>
          <li>{t('guide.noteOfficial')}</li>
        </ul>
      </section>

      <section className="gd-sec" aria-labelledby="gd-sources">
        <h2 className="gd-sec-title" id="gd-sources">
          {t('guide.sources')}
        </h2>
        <ul className="gd-sources">
          {RULESET.sources.map((s) => (
            <li key={s.url}>
              <ExtLink href={s.url}>{s.label[lang]}</ExtLink>
              <span className="gd-host">{new URL(s.url).hostname}</span>
            </li>
          ))}
        </ul>
        <p className="small muted num">{t('guide.checkedOn', { date: RULESET.checkedAt })}</p>
      </section>

      <section className="gd-sec" id="privacy" tabIndex={-1} aria-labelledby="gd-privacy">
        <h2 className="gd-sec-title" id="gd-privacy">
          {t('guide.privacy')}
        </h2>
        <div className="gd-privacy">
          <p>{t('guide.privacyLocal')}</p>
          <p>{t('guide.privacyCounts')}</p>
          <ul className="gd-plist">
            {PRIVACY_ITEMS.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
          <p>
            <strong>{t('guide.privacyNever')}</strong>
          </p>
          <p>{t('guide.privacyOff')}</p>
          <p>{t('guide.privacyBuild')}</p>
          <p className="gd-now small" data-testid="guide-counter-status">
            {t('guide.privacyNow', { status: counterStatusText(settings.counter, t) })}
          </p>
        </div>
      </section>
    </main>
  )
}
