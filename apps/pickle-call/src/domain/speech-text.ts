// 読み上げる文と、表示する名前を作る純関数。
import { teamOf } from './engine'
import type { GameState, Lang, PlayerId, Setup, Team, View } from './types'

export type NumStyle = 'kana' | 'ja' | 'en'

const KANA_ONES = ['ゼロ', 'ワン', 'ツー', 'スリー', 'フォー', 'ファイブ', 'シックス', 'セブン', 'エイト', 'ナイン']
const KANA_TEENS = ['テン', 'イレブン', 'トゥエルブ', 'サーティーン', 'フォーティーン', 'フィフティーン', 'シックスティーン', 'セブンティーン', 'エイティーン', 'ナインティーン']
const KANA_TENS = ['', '', 'トゥエンティ', 'サーティ', 'フォーティ', 'フィフティ', 'シックスティ', 'セブンティ', 'エイティ', 'ナインティ']

const JA_ONES = ['ゼロ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう']

const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const EN_TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/** 0〜99 を読み方に直す。範囲外は数字のまま */
export function numberWords(n: number, style: NumStyle): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n)
  const t = Math.floor(n / 10)
  const o = n % 10
  if (style === 'kana') {
    if (n < 10) return KANA_ONES[n]
    if (n < 20) return KANA_TEENS[o]
    return KANA_TENS[t] + (o ? KANA_ONES[o] : '')
  }
  if (style === 'ja') {
    if (n < 10) return JA_ONES[n]
    const tens = t === 1 ? 'じゅう' : `${JA_ONES[t]}じゅう`
    return tens + (o ? JA_ONES[o] : '')
  }
  if (n < 10) return EN_ONES[n]
  if (n < 20) return EN_TEENS[o]
  return EN_TENS[t] + (o ? `-${EN_ONES[o]}` : '')
}

/**
 * 名前の前後の空白と制御文字を除き、最大10文字（コードポイント単位）にする。
 * 除くもの: C0/C1 制御文字、ゼロ幅文字（U+200B〜U+200F）、行・段落区切りと双方向の埋め込み／上書き（U+2028〜U+202E）、
 * 双方向の分離（U+2066〜U+2069）、アラビア文字の記号（U+061C）、語結合子など（U+2060〜U+2064）、BOM（U+FEFF）。
 * 正規表現は \u エスケープで書く（見えない双方向文字をソースに直接置かない）。
 */
export function cleanName(raw: string | undefined): string {
  if (!raw) return ''
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g, '').trim()
  // 10文字で切った後にも空白が端に残らないようにする
  return Array.from(s).slice(0, 10).join('').trim()
}

export const teamLabel = (t: Team, lang: Lang) => (lang === 'ja' ? `${t}チーム` : `Team ${t}`)

/** 画面に出す名前。未入力なら「A1」のような記号 */
export function displayName(p: PlayerId, setup: Setup): string {
  return cleanName(setup.names[p]) || p
}

export function hasName(p: PlayerId, setup: Setup): boolean {
  return cleanName(setup.names[p]) !== ''
}

/** チームの呼び名。全員の名前があれば「あおい・そら」、なければ「Aチーム」 */
export function teamName(t: Team, setup: Setup, lang: Lang): string {
  const ps: PlayerId[] = setup.format.kind === 'doubles' ? [`${t}1` as PlayerId, `${t}2` as PlayerId] : [`${t}1` as PlayerId]
  if (ps.every((p) => hasName(p, setup))) return ps.map((p) => cleanName(setup.names[p])).join(lang === 'ja' ? '・' : ' & ')
  return teamLabel(t, lang)
}

/** スコア係で読み上げる文 */
export function voiceText(view: View, setup: Setup, lang: Lang, numStyle: NumStyle): string {
  const style: NumStyle = lang === 'en' ? 'en' : numStyle === 'en' ? 'kana' : numStyle
  const nums = view.call.map((n) => numberWords(n, style))
  const who = hasName(view.server, setup) ? cleanName(setup.names[view.server]) : teamLabel(teamOf(view.server), lang)
  const key = view.explain.key
  if (lang === 'en') {
    const pre = view.isSideOut ? 'Side out. ' : key === 'second-server' ? 'Second server. ' : ''
    const n = nums.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(', ')
    const side = view.serverSide === 'right' ? 'right' : 'left'
    const end = view.endChangeNow ? ' End change point.' : ''
    return `${pre}${n}. Server ${who}, from the ${side}.${end}`
  }
  const pre = view.isSideOut ? 'サイドアウト。' : key === 'second-server' ? 'セカンドサーバー。' : ''
  const side = view.serverSide === 'right' ? '右' : '左'
  const end = view.endChangeNow ? 'エンドチェンジの目安です。' : ''
  return `${pre}${nums.join('、')}。サーバー ${who}、${side}から。${end}`
}

/**
 * ゲーム終了の読み上げ文。numStyle を渡すと、日本語では最終スコアもコールと同じ読み方にする
 * （カタカナ英語なら「イレブン対ゼロ」）。渡さなければ数字のまま
 */
export function gameText(state: GameState, setup: Setup, lang: Lang, numStyle?: NumStyle): string {
  if (!state.winner) return ''
  const w = state.winner
  const l = w === 'A' ? 'B' : 'A'
  const name = teamName(w, setup, lang)
  if (lang === 'en') {
    // 2人の名前（Aoi & Sora）なら複数形の動詞にする
    const verb = name.includes(' & ') ? 'win' : 'wins'
    return `Game. ${name} ${verb}, ${state.score[w]} to ${state.score[l]}.`
  }
  const style: NumStyle | null = numStyle ? (numStyle === 'en' ? 'kana' : numStyle) : null
  const say = (n: number) => (style ? numberWords(n, style) : String(n))
  return `ゲーム。${name}の勝ち、${say(state.score[w])}対${say(state.score[l])}。`
}
