// 規則データ（rules/usap-2026.ts）: 条番号・出典・確認日・説明文がそろっていること。
// 2026年版で章立てと条番号が全面的に変わったので、旧番号（4.A.1・4.B.1・4.F など）が紛れ込んでいないことも確かめる。
import { describe, expect, it } from 'vitest'
import { SCENES } from './learn'
import { RULESET, startKey } from './rules/usap-2026'
import type { ExplainKey } from './types'

/** ExplainKey の全部。型で網羅を強制する（キーが増減したらここがコンパイルエラーになる） */
const ALL_KEYS_RECORD: Record<ExplainKey, true> = {
  start: true,
  'start-singles': true,
  'start-rally': true,
  point: true,
  'point-singles': true,
  'second-server': true,
  'side-out': true,
  'side-out-start': true,
  'side-out-singles': true,
  'rally-point': true,
  'rally-point-singles': true,
  'rally-side-out': true,
  'rally-side-out-singles': true,
  game: true,
  manual: true,
}
const ALL_KEYS = Object.keys(ALL_KEYS_RECORD) as ExplainKey[]

/** 2026年版より前の番号の形（旧4章のサーブ・得点の細目など） */
const PRE_2026 = [/^4\.[A-Z]\.\d/, /^4\.[C-Z](\.|$)/]
const isPre2026 = (ref: string) => PRE_2026.some((re) => re.test(ref))

const usedRefs = () => [...Object.values(RULESET.explainRefs).flat(), ...SCENES.flatMap((s) => s.refs)]

describe('条番号', () => {
  it('説明キーと学ぶの場面が使う条番号は、すべて RULESET.refs にある', () => {
    const missing = usedRefs().filter((r) => !(r in RULESET.refs))
    expect(missing).toEqual([])
  })

  it('条番号の見出しは日英とも空でない', () => {
    for (const [ref, t] of Object.entries(RULESET.refs)) {
      expect(t.ja.trim(), ref).not.toBe('')
      expect(t.en.trim(), ref).not.toBe('')
    }
  })

  it('条番号は「数字.英大文字(.数字)*」か、変更点の番号「CD-数字」の形', () => {
    for (const ref of Object.keys(RULESET.refs)) expect(ref).toMatch(/^(\d{1,2}\.[A-Z](\.\d{1,2})*|CD-\d+)$/)
  })

  it('旧番号（4.A.1・4.B.1・4.F など）を使っていない', () => {
    expect(isPre2026('4.A.1')).toBe(true)
    expect(isPre2026('4.B.1')).toBe(true)
    expect(isPre2026('4.F')).toBe(true)
    expect(isPre2026('4.A')).toBe(false)
    expect(isPre2026('5.B.3')).toBe(false)
    const bad = [...Object.keys(RULESET.refs), ...usedRefs()].filter(isPre2026)
    expect(bad).toEqual([])
  })

  it('説明の文にも旧番号を書いていない', () => {
    const texts = [...Object.values(RULESET.summaries).flatMap((s) => [s.ja, s.en]), ...SCENES.flatMap((s) => [s.note?.ja ?? '', s.note?.en ?? ''])]
    for (const t of texts) expect(t).not.toMatch(/(^|[^\d.])4\.([A-Z]\.\d|[C-Z](?![a-z]))/)
  })

  it('同じ説明キーの中で条番号が重複しない。manual 以外は1つ以上ある', () => {
    for (const k of ALL_KEYS) {
      const refs = RULESET.explainRefs[k]
      expect(new Set(refs).size, k).toBe(refs.length)
      if (k !== 'manual') expect(refs.length, k).toBeGreaterThan(0)
    }
    expect(RULESET.explainRefs.manual).toEqual([])
  })

  it('仕様 §6.3 の主な対応（得点 4.A、勝ち 4.B、ラリー方式 14.A.2、2026改訂 CD-2242）', () => {
    expect(RULESET.explainRefs.point).toContain('4.A')
    expect(RULESET.explainRefs.game).toContain('4.B')
    expect(RULESET.explainRefs.start).toEqual(expect.arrayContaining(['5.B', '5.B.2', '6.B.2']))
    expect(RULESET.explainRefs['rally-side-out']).toEqual(expect.arrayContaining(['14.A.2', '14.A.4', '14.A.5']))
    expect(sceneRefs('rally-win')).toContain('CD-2242')
    expect(sceneRefs('end-change')).toContain('21.B.1')
  })
})

const sceneRefs = (id: string) => SCENES.find((s) => s.id === id)?.refs ?? []

describe('説明文（なぜこのスコア？）', () => {
  it('ExplainKey のすべてに日英の要約がある（余分なキーもない）', () => {
    expect(Object.keys(RULESET.summaries).sort()).toEqual([...ALL_KEYS].sort())
    expect(Object.keys(RULESET.explainRefs).sort()).toEqual([...ALL_KEYS].sort())
    for (const k of ALL_KEYS) {
      expect(RULESET.summaries[k].ja.trim(), k).not.toBe('')
      expect(RULESET.summaries[k].en.trim(), k).not.toBe('')
    }
  })

  it('日本語の要約は です・ます で終わり、英語の要約は文の終わりの記号で終わる', () => {
    for (const k of ALL_KEYS) {
      expect(RULESET.summaries[k].ja, k).toMatch(/(です|ます|ました|ません)(（[^）]*）)?。$/)
      expect(RULESET.summaries[k].en, k).toMatch(/[.!?)"”]$/)
    }
  })

  it('開始の要約は 0-0-2 を、シングルスの開始は 0-0 を説明する', () => {
    expect(RULESET.summaries.start.ja).toContain('0-0-2')
    expect(RULESET.summaries.start.en).toContain('0-0-2')
    expect(RULESET.summaries['start-singles'].ja).toContain('0-0')
  })

  it('startKey は形式に合う開始のキーを返す', () => {
    expect(startKey('doubles', 'sideout')).toBe('start')
    expect(startKey('doubles', 'rally')).toBe('start-rally')
    expect(startKey('singles', 'sideout')).toBe('start-singles')
    expect(startKey('singles', 'rally')).toBe('start-singles')
  })
})

describe('出典・確認日・エンドチェンジ', () => {
  it('出典はすべて https で、ラベルは日英とも空でない。URL は重複しない', () => {
    expect(RULESET.sources.length).toBeGreaterThan(0)
    for (const s of RULESET.sources) {
      expect(new URL(s.url).protocol).toBe('https:')
      expect(s.label.ja.trim()).not.toBe('')
      expect(s.label.en.trim()).not.toBe('')
    }
    expect(new Set(RULESET.sources.map((s) => s.url)).size).toBe(RULESET.sources.length)
  })

  it('USA Pickleball の公式ページを出典に含む', () => {
    expect(RULESET.sources.some((s) => new URL(s.url).hostname === 'usapickleball.org')).toBe(true)
  })

  it('checkedAt は実在する日付の YYYY-MM-DD', () => {
    expect(RULESET.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const d = new Date(`${RULESET.checkedAt}T00:00:00Z`)
    expect(Number.isNaN(d.getTime())).toBe(false)
    expect(d.toISOString().slice(0, 10)).toBe(RULESET.checkedAt)
    expect(Number(RULESET.checkedAt.slice(0, 4))).toBeGreaterThanOrEqual(2026)
  })

  it('id と題名', () => {
    expect(RULESET.id).toBe('usap-2026')
    expect(RULESET.title.ja).toContain('2026')
    expect(RULESET.title.en).toContain('2026')
  })

  it('エンドチェンジの目安は 11点→6、15点→8、21点→11（21.B.1〜21.B.3）。どれも目標点より小さい', () => {
    expect(RULESET.endChange).toEqual({ 11: 6, 15: 8, 21: 11 })
    for (const t of [11, 15, 21] as const) expect(RULESET.endChange[t]).toBeLessThan(t)
    for (const r of ['21.B.1', '21.B.2', '21.B.3', '21.B.4']) expect(RULESET.refs).toHaveProperty([r])
  })
})
