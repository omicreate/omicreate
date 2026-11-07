// 言葉の辞書（i18n）: 日英で同じキー、空の文字列なし、差し込み {x} が日英で一致、キーは担当の名前空間、
// 辞書をまたいだ重複なし。translate() の差し込みと、足りないときの戻り先。
import { describe, expect, it } from 'vitest'
import common from './common'
import { dicts, makeT, translate, type TKey } from './index'
import learn from './learn'
import play from './play'
import screens from './screens'

type Area = { ja: Record<string, string>; en: Record<string, string> }
const AREAS: Record<string, { dict: Area; namespaces: string[] }> = {
  common: { dict: common, namespaces: ['app', 'nav', 'common', 'court'] },
  play: { dict: play, namespaces: ['play', 'result'] },
  screens: { dict: screens, namespaces: ['home', 'setup', 'history', 'settings', 'guide'] },
  learn: { dict: learn, namespaces: ['learn'] },
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
/** ひらがな・カタカナ・漢字 */
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/

describe.each(Object.entries(AREAS))('%s.ts', (_name, { dict, namespaces }) => {
  it('ja と en のキーがまったく同じ', () => {
    const ja = Object.keys(dict.ja).sort()
    const en = Object.keys(dict.en).sort()
    expect(en.filter((k) => !ja.includes(k))).toEqual([])
    expect(ja.filter((k) => !en.includes(k))).toEqual([])
  })

  it('空の文字列がない', () => {
    for (const lang of ['ja', 'en'] as const) {
      const empty = Object.entries(dict[lang]).filter(([, v]) => typeof v !== 'string' || v.trim() === '')
      expect(empty.map(([k]) => `${lang}:${k}`)).toEqual([])
    }
  })

  it('差し込み {x} の名前が、キーごとに ja と en で一致する', () => {
    const diff = Object.keys(dict.ja)
      .filter((k) => k in dict.en)
      .filter((k) => placeholders(dict.ja[k]).join(',') !== placeholders(dict.en[k]).join(','))
      .map((k) => `${k}: ja{${placeholders(dict.ja[k])}} en{${placeholders(dict.en[k])}}`)
    expect(diff).toEqual([])
  })

  it(`キーは担当の名前空間（${namespaces.join(', ')}）で始まる`, () => {
    const outside = Object.keys(dict.ja).filter((k) => !namespaces.some((ns) => k.startsWith(`${ns}.`)))
    expect(outside).toEqual([])
  })

  it('英語の文に日本語が残っていない（日英で同じ表記にしたもの、例: 言語名は除く）', () => {
    const left = Object.entries(dict.en)
      .filter(([k, v]) => JAPANESE.test(v) && v !== dict.ja[k])
      .map(([k]) => k)
    expect(left).toEqual([])
  })

  it('閉じていない波かっこがない', () => {
    for (const lang of ['ja', 'en'] as const) {
      for (const [k, v] of Object.entries(dict[lang])) {
        const opens = (v.match(/\{/g) ?? []).length
        const closes = (v.match(/\}/g) ?? []).length
        expect(opens, `${lang}:${k}`).toBe(closes)
      }
    }
  })
})

describe('辞書のまとめ', () => {
  it('辞書をまたいでキーが重複しない（まとめたときに黙って上書きされない）', () => {
    const seen = new Map<string, string>()
    const dup: string[] = []
    for (const [name, { dict }] of Object.entries(AREAS)) {
      for (const k of Object.keys(dict.ja)) {
        if (seen.has(k)) dup.push(`${k} (${seen.get(k)} と ${name})`)
        seen.set(k, name)
      }
    }
    expect(dup).toEqual([])
  })

  it('dicts.ja と dicts.en は全辞書のキーを持ち、同じ数', () => {
    const total = Object.values(AREAS).reduce((n, { dict }) => n + Object.keys(dict.ja).length, 0)
    expect(Object.keys(dicts.ja)).toHaveLength(total)
    expect(Object.keys(dicts.en)).toHaveLength(total)
  })
})

describe('translate', () => {
  it('差し込みを置き換える（数字もそのまま文字に）', () => {
    expect(translate('ja', 'common.team', { team: 'A' })).toBe('Aチーム')
    expect(translate('en', 'common.team', { team: 'B' })).toBe('Team B')
    expect(translate('ja', 'common.points', { n: 11 })).toBe('11点')
    expect(translate('en', 'common.points', { n: 0 })).toBe('0 points')
  })

  it('複数の差し込みをそれぞれ置き換える。渡されなかった差し込みはそのまま残す', () => {
    const k: TKey = 'common.checkedAt'
    expect(translate('ja', k, { title: 'T', date: '2026-11-06' })).toBe('Tで確認（2026-11-06）')
    expect(translate('ja', k, { title: 'T' })).toBe('Tで確認（{date}）')
    expect(translate('ja', 'common.team')).toBe('{team}チーム')
  })

  it('余分な差し込みは無視する', () => {
    expect(translate('en', 'nav.home', { x: 1 })).toBe('Home')
  })

  it('英語に無いキーは日本語へ、どちらにも無いキーはキーそのものへ戻る', () => {
    const en = dicts.en as Record<string, string>
    const saved = en['nav.home']
    delete en['nav.home']
    try {
      expect(translate('en', 'nav.home')).toBe(dicts.ja['nav.home'])
    } finally {
      en['nav.home'] = saved
    }
    expect(translate('en', 'nav.home')).toBe('Home')
    expect(translate('ja', 'no.such.key' as TKey)).toBe('no.such.key')
    expect(translate('en', 'no.such.key' as TKey, { a: 1 })).toBe('no.such.key')
  })

  it('makeT は言語を固定した translate', () => {
    const t = makeT('en')
    expect(t('common.team', { team: 'A' })).toBe('Team A')
    expect(makeT('ja')('app.name')).toBe('ピックルコール')
  })
})
