/** 文字の正規化（1行入力・検索・健康語の照合で共通に使う） */

/** NFKC と前後の空白除去 */
export function nfkc(s: string): string {
  return s.normalize('NFKC').trim()
}

/** カタカナをひらがなにそろえる（ァ〜ヶ → ぁ〜ゖ）。長音記号などはそのまま */
export function katakanaToHiragana(s: string): string {
  let out = ''
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (code >= 0x30a1 && code <= 0x30f6) out += String.fromCodePoint(code - 0x60)
    else out += ch
  }
  return out
}

/** 照合用の形: NFKC → カタカナをひらがなに → 英字を小文字に */
export function matchKey(s: string): string {
  return katakanaToHiragana(nfkc(s)).toLowerCase()
}

/** 呼び名・かなの前方一致（検索欄と1行入力で使う） */
export function nameStartsWith(nickname: string, kana: string | undefined, query: string): boolean {
  const q = matchKey(query)
  if (!q) return false
  return matchKey(nickname).startsWith(q) || (kana ? matchKey(kana).startsWith(q) : false)
}

const collator = new Intl.Collator('ja')

/** 五十音順の比較（かながあればかなで、なければ呼び名をひらがなにして） */
export function compareNames(
  a: { nickname: string; kana?: string },
  b: { nickname: string; kana?: string },
): number {
  const ka = matchKey(a.kana || a.nickname)
  const kb = matchKey(b.kana || b.nickname)
  const c = collator.compare(ka, kb)
  if (c !== 0) return c
  return collator.compare(a.nickname, b.nickname)
}

/** 複数行の文字列の1行目（空なら空文字） */
export function firstLine(text: string | undefined): string {
  if (!text) return ''
  const line = text.split(/\r?\n/).find((l) => l.trim() !== '')
  return line ? line.trim() : ''
}

/** 文字数（サロゲートペアを1文字と数える） */
export function charLength(s: string): number {
  return Array.from(s).length
}
