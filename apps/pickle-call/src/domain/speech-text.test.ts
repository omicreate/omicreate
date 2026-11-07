// 読み上げの文と名前（speech-text.ts）。期待値は実装から写さず、仕様 §8 の例と読み方の表から手で書いた。
import { describe, expect, it } from 'vitest'
import { applyEvent, initialState } from './engine'
import { cleanName, displayName, gameText, hasName, numberWords, teamLabel, teamName, voiceText } from './speech-text'
import type { Format, GameEvent, PlayerId, Setup, Team } from './types'
import { viewFromEvents } from './view'

function setupOf(format: Partial<Format> = {}, names: Partial<Record<PlayerId, string>> = {}): Setup {
  return {
    format: { kind: 'doubles', scoring: 'sideout', target: 11, winBy: 2, ...format },
    names,
    startingServer: { A: 'A1', B: 'B1' },
    firstServingTeam: 'A',
    rulesetId: 'usap-2026',
  }
}

const ev = (seq: string): GameEvent[] =>
  seq
    .split(' ')
    .filter(Boolean)
    .map((w, i) => ({ type: 'rally', winner: w as Team, at: i }))

const JA_NAMES = { A1: 'あおい', A2: 'そら', B1: 'はると', B2: 'りん' }
const EN_NAMES = { A1: 'Aoi', A2: 'Sora', B1: 'Haruto', B2: 'Rin' }

describe('numberWords: 0〜30 と 99', () => {
  const KANA = [
    'ゼロ', 'ワン', 'ツー', 'スリー', 'フォー', 'ファイブ', 'シックス', 'セブン', 'エイト', 'ナイン',
    'テン', 'イレブン', 'トゥエルブ', 'サーティーン', 'フォーティーン', 'フィフティーン', 'シックスティーン', 'セブンティーン', 'エイティーン', 'ナインティーン',
    'トゥエンティ', 'トゥエンティワン', 'トゥエンティツー', 'トゥエンティスリー', 'トゥエンティフォー', 'トゥエンティファイブ',
    'トゥエンティシックス', 'トゥエンティセブン', 'トゥエンティエイト', 'トゥエンティナイン', 'サーティ',
  ]
  const JA = [
    'ゼロ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう',
    'じゅう', 'じゅういち', 'じゅうに', 'じゅうさん', 'じゅうよん', 'じゅうご', 'じゅうろく', 'じゅうなな', 'じゅうはち', 'じゅうきゅう',
    'にじゅう', 'にじゅういち', 'にじゅうに', 'にじゅうさん', 'にじゅうよん', 'にじゅうご', 'にじゅうろく', 'にじゅうなな', 'にじゅうはち', 'にじゅうきゅう',
    'さんじゅう',
  ]
  const EN = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
    'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine',
    'thirty',
  ]

  it('表は0〜30の31個ずつ', () => {
    expect([KANA.length, JA.length, EN.length]).toEqual([31, 31, 31])
  })

  it.each(KANA.map((w, n) => [n, w] as const))('kana %i → %s', (n, w) => expect(numberWords(n, 'kana')).toBe(w))
  it.each(JA.map((w, n) => [n, w] as const))('ja %i → %s', (n, w) => expect(numberWords(n, 'ja')).toBe(w))
  it.each(EN.map((w, n) => [n, w] as const))('en %i → %s', (n, w) => expect(numberWords(n, 'en')).toBe(w))

  it('よく出る数の読み（仕様の例）', () => {
    expect(numberWords(11, 'kana')).toBe('イレブン')
    expect(numberWords(12, 'kana')).toBe('トゥエルブ')
    expect(numberWords(21, 'kana')).toBe('トゥエンティワン')
    expect(numberWords(10, 'ja')).toBe('じゅう')
    expect(numberWords(11, 'ja')).toBe('じゅういち')
    expect(numberWords(20, 'ja')).toBe('にじゅう')
    expect(numberWords(21, 'en')).toBe('twenty-one')
  })

  it('99', () => {
    expect(numberWords(99, 'kana')).toBe('ナインティナイン')
    expect(numberWords(99, 'ja')).toBe('きゅうじゅうきゅう')
    expect(numberWords(99, 'en')).toBe('ninety-nine')
  })

  it('40〜90 の十の位', () => {
    expect([40, 50, 60, 70, 80, 90].map((n) => numberWords(n, 'kana'))).toEqual(['フォーティ', 'フィフティ', 'シックスティ', 'セブンティ', 'エイティ', 'ナインティ'])
    expect([40, 50, 60, 70, 80, 90].map((n) => numberWords(n, 'ja'))).toEqual(['よんじゅう', 'ごじゅう', 'ろくじゅう', 'ななじゅう', 'はちじゅう', 'きゅうじゅう'])
    expect([40, 50, 60, 70, 80, 90].map((n) => numberWords(n, 'en'))).toEqual(['forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'])
  })

  it.each(['kana', 'ja', 'en'] as const)('%s: 範囲外や整数でない数は数字のまま', (style) => {
    expect(numberWords(-1, style)).toBe('-1')
    expect(numberWords(100, style)).toBe('100')
    expect(numberWords(1.5, style)).toBe('1.5')
    expect(numberWords(Number.NaN, style)).toBe('NaN')
  })

  it.each(['kana', 'ja', 'en'] as const)('%s: 0〜99 はどれも空でなく、数字を含まない', (style) => {
    for (let n = 0; n <= 99; n += 1) {
      const w = numberWords(n, style)
      expect(w.length).toBeGreaterThan(0)
      expect(w).not.toMatch(/\d|undefined/)
    }
  })
})

describe('voiceText（スコア係で読み上げる文）', () => {
  const view = (setup: Setup, seq: string) => viewFromEvents(setup, ev(seq)).view

  it('ja: サイドアウトの前置きと名前（仕様の例そのまま）', () => {
    const s = setupOf({}, JA_NAMES)
    expect(voiceText(view(s, 'A B'), s, 'ja', 'kana')).toBe('サイドアウト。ゼロ、ワン、ワン。サーバー はると、右から。')
  })

  it('en: サイドアウトの前置きと名前（仕様の例そのまま）', () => {
    const s = setupOf({}, EN_NAMES)
    expect(voiceText(view(s, 'A B'), s, 'en', 'kana')).toBe('Side out. Zero, one, one. Server Haruto, from the right.')
  })

  it('名前がなければチーム名で呼ぶ', () => {
    const s = setupOf()
    expect(voiceText(view(s, ''), s, 'ja', 'kana')).toBe('ゼロ、ゼロ、ツー。サーバー Aチーム、右から。')
    expect(voiceText(view(s, ''), s, 'en', 'kana')).toBe('Zero, zero, two. Server Team A, from the right.')
    expect(voiceText(view(s, 'A B'), s, 'ja', 'kana')).toBe('サイドアウト。ゼロ、ワン、ワン。サーバー Bチーム、右から。')
  })

  it('サーバーだけ名前がないときも、そのチーム名で呼ぶ（相手の名前は使わない）', () => {
    const s = setupOf({}, { A2: 'そら', B1: 'はると' })
    expect(voiceText(view(s, ''), s, 'ja', 'kana')).toBe('ゼロ、ゼロ、ツー。サーバー Aチーム、右から。')
  })

  it('得点した後は左から（同じサーバーが左右を替える）', () => {
    const s = setupOf({}, JA_NAMES)
    expect(voiceText(view(s, 'A'), s, 'ja', 'kana')).toBe('ワン、ゼロ、ツー。サーバー あおい、左から。')
    expect(voiceText(view(setupOf({}, EN_NAMES), 'A'), setupOf({}, EN_NAMES), 'en', 'kana')).toBe('One, zero, two. Server Aoi, from the left.')
  })

  it('2人目のサーバーの前置き', () => {
    const s = setupOf({}, JA_NAMES)
    // A B B A: B が 1-1-1 でサーブ中に負け、B2（りん）が2人目として右から
    expect(voiceText(view(s, 'A B B A'), s, 'ja', 'kana')).toBe('セカンドサーバー。ワン、ワン、ツー。サーバー りん、右から。')
    const e = setupOf({}, EN_NAMES)
    expect(voiceText(view(e, 'A B B A'), e, 'en', 'kana')).toBe('Second server. One, one, two. Server Rin, from the right.')
  })

  it('エンドチェンジの目安の後置き', () => {
    const s = setupOf()
    const v = view(s, 'A A A A A A')
    expect(v.endChangeNow).toBe(true)
    expect(voiceText(v, s, 'ja', 'kana')).toBe('シックス、ゼロ、ツー。サーバー Aチーム、右から。エンドチェンジの目安です。')
    expect(voiceText(v, s, 'en', 'kana')).toBe('Six, zero, two. Server Team A, from the right. End change point.')
  })

  it('数字の読み方: ja を選ぶと日本語読み。en を選んでも日本語のときはカタカナ英語。英語のときはいつも英語', () => {
    const s = setupOf()
    const v2 = view(s, 'A A A A A A A A A A') // 10-0-2
    expect(voiceText(v2, s, 'ja', 'ja')).toBe('じゅう、ゼロ、に。サーバー Aチーム、右から。')
    expect(voiceText(v2, s, 'ja', 'en')).toBe('テン、ゼロ、ツー。サーバー Aチーム、右から。')
    expect(voiceText(v2, s, 'en', 'ja')).toBe('Ten, zero, two. Server Team A, from the right.')
  })

  it('シングルスとラリー方式は2つの数字', () => {
    const sg = setupOf({ kind: 'singles' }, { A1: 'あおい', B1: 'はると' })
    expect(voiceText(view(sg, 'A A A'), sg, 'ja', 'kana')).toBe('スリー、ゼロ。サーバー あおい、左から。')
    const r = setupOf({ scoring: 'rally' })
    expect(voiceText(view(r, 'A B'), r, 'ja', 'kana')).toBe('サイドアウト。ワン、ワン。サーバー Bチーム、右から。')
    expect(voiceText(view(r, 'A B'), r, 'en', 'kana')).toBe('Side out. One, one. Server Team B, from the right.')
  })

  it('名前の制御文字は読み上げに入らない', () => {
    const s = setupOf({}, { A1: '  あお‮い\u0007  ' })
    expect(voiceText(view(s, ''), s, 'ja', 'kana')).toBe('ゼロ、ゼロ、ツー。サーバー あおい、右から。')
  })
})

describe('gameText（ゲーム終了の文）', () => {
  const finished = (setup: Setup, score: Record<Team, number>, servingTeam: Team) =>
    applyEvent(
      initialState(setup),
      { type: 'set', score, servingTeam, serverNumber: 1, server: servingTeam === 'A' ? 'A1' : 'B1', startingServer: { A: 'A1', B: 'B1' }, at: 0 },
      setup,
    )

  it('名前なし（仕様の例そのまま）', () => {
    const s = setupOf()
    const st = finished(s, { A: 11, B: 7 }, 'A')
    expect(gameText(st, s, 'ja')).toBe('ゲーム。Aチームの勝ち、11対7。')
    expect(gameText(st, s, 'en')).toBe('Game. Team A wins, 11 to 7.')
  })

  it('勝ったのが B なら、B の点を先に言う', () => {
    const s = setupOf()
    const st = finished(s, { A: 9, B: 11 }, 'B')
    expect(gameText(st, s, 'ja')).toBe('ゲーム。Bチームの勝ち、11対9。')
    expect(gameText(st, s, 'en')).toBe('Game. Team B wins, 11 to 9.')
  })

  it('全員の名前があれば名前で呼ぶ（ダブルスは2人、シングルスは1人）', () => {
    const s = setupOf({}, JA_NAMES)
    expect(gameText(finished(s, { A: 11, B: 7 }, 'A'), s, 'ja')).toBe('ゲーム。あおい・そらの勝ち、11対7。')
    const e = setupOf({}, EN_NAMES)
    expect(gameText(finished(e, { A: 11, B: 7 }, 'A'), e, 'en')).toBe('Game. Aoi & Sora win, 11 to 7.')
    const sg = setupOf({ kind: 'singles' }, { A1: 'あおい' })
    expect(gameText(finished(sg, { A: 11, B: 3 }, 'A'), sg, 'ja')).toBe('ゲーム。あおいの勝ち、11対3。')
  })

  it('数字の読み方を渡すと、日本語では最終スコアもコールと同じ読み方にする（英語は数字のまま）', () => {
    const s = setupOf()
    const st = finished(s, { A: 11, B: 0 }, 'A')
    expect(gameText(st, s, 'ja', 'kana')).toBe('ゲーム。Aチームの勝ち、イレブン対ゼロ。')
    expect(gameText(st, s, 'ja', 'en')).toBe('ゲーム。Aチームの勝ち、イレブン対ゼロ。')
    expect(gameText(st, s, 'ja', 'ja')).toBe('ゲーム。Aチームの勝ち、じゅういち対ゼロ。')
    expect(gameText(st, s, 'en', 'kana')).toBe('Game. Team A wins, 11 to 0.')
  })

  it('勝者がまだいなければ空文字', () => {
    const s = setupOf()
    expect(gameText(initialState(s), s, 'ja')).toBe('')
    expect(gameText(finished(s, { A: 11, B: 10 }, 'A'), s, 'en')).toBe('')
  })
})

describe('名前（cleanName・displayName・teamName）', () => {
  it('前後の空白を除く（全角スペースも）', () => {
    expect(cleanName('  あおい  ')).toBe('あおい')
    expect(cleanName('　そら　')).toBe('そら')
  })

  it('制御文字と双方向の制御文字・ゼロ幅文字を除く', () => {
    expect(cleanName('a\u0000b\u001fc\u007fd\u009fe')).toBe('abcde')
    expect(cleanName('あ\nお\tい')).toBe('あおい')
    expect(cleanName('a‮b‪c⁦d⁩e')).toBe('abcde')
    expect(cleanName('​か‌な‍‎‏')).toBe('かな')
    expect(cleanName('﻿x⁠y؜z')).toBe('xyz')
    expect(cleanName('a b c')).toBe('abc')
  })

  it('最大10文字（コードポイント単位。絵文字1つも1文字）', () => {
    expect(cleanName('あいうえおかきくけこさしす')).toBe('あいうえおかきくけこ')
    expect(cleanName('abcdefghijklmnop')).toBe('abcdefghij')
    const emoji = cleanName('😀'.repeat(12))
    expect(Array.from(emoji)).toHaveLength(10)
    expect(emoji).toBe('😀'.repeat(10))
  })

  it('切った後の端の空白も残さない', () => {
    expect(cleanName('abcdefghi jkl')).toBe('abcdefghi')
  })

  it('空・未設定・空白だけは空文字', () => {
    expect(cleanName(undefined)).toBe('')
    expect(cleanName('')).toBe('')
    expect(cleanName('   ')).toBe('')
    expect(cleanName('​‮')).toBe('')
  })

  it('displayName: 名前がなければ A1 のような記号。hasName も同じ判定', () => {
    const s = setupOf({}, { A1: ' あおい ', A2: '   ', B1: '​' })
    expect(displayName('A1', s)).toBe('あおい')
    expect(displayName('A2', s)).toBe('A2')
    expect(displayName('B1', s)).toBe('B1')
    expect(displayName('B2', s)).toBe('B2')
    expect([hasName('A1', s), hasName('A2', s), hasName('B1', s), hasName('B2', s)]).toEqual([true, false, false, false])
  })

  it('teamName: 全員の名前があれば名前（日本語は「・」、英語は「 & 」）、1人でも欠けたらチーム名', () => {
    const s = setupOf({}, { A1: 'あおい', A2: 'そら', B1: 'はると' })
    expect(teamName('A', s, 'ja')).toBe('あおい・そら')
    expect(teamName('A', s, 'en')).toBe('あおい & そら')
    expect(teamName('B', s, 'ja')).toBe('Bチーム')
    expect(teamName('B', s, 'en')).toBe('Team B')
    const sg = setupOf({ kind: 'singles' }, { B1: 'はると' })
    expect(teamName('B', sg, 'ja')).toBe('はると')
    expect(teamName('A', sg, 'ja')).toBe('Aチーム')
  })

  it('teamLabel', () => {
    expect(teamLabel('A', 'ja')).toBe('Aチーム')
    expect(teamLabel('B', 'en')).toBe('Team B')
  })
})
