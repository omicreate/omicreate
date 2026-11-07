/** 1行入力の解析（仕様 6.11）。結果は必ず画面で確認してから保存する（自動では保存しない） */
import { isValidYMD, parseISODate, toISODate } from './dates'
import { compareNames, matchKey, nameStartsWith, nfkc } from './text'
import type { Customer, ID, ISODate, Menu, NextPlan } from './types'

export interface OneLineResult {
  /** 名前の語に前方一致した客（完全一致が先頭）。名前の語がなく選択済みの客があればその客 */
  customerMatches: Customer[]
  /** 名前として読んだ語（敬称を除いたもの） */
  nameToken?: string
  menuIds: ID[]
  next?: NextPlan
  price?: number
  /** 読み取れなかった語 */
  unparsed: string[]
  /** 注意（「次回の指定が2つありました」など） */
  warnings: string[]
}

export const ONE_LINE_WARNINGS = {
  multipleNext: '次回の指定が2つありました',
  bookedSameDay: '予約日は来店日より後の日付にしてください',
} as const

const SEPARATORS = /[\s、，,・+＋]+/
const DATE_RE = /^(\d{1,2})[/月](\d{1,2})日?$/
const WEEK_RE = /^(\d{1,2})(週間|週|w)後?$/i
const MONTH_RE = /^(\d{1,2})(か月|ヶ月|カ月|ケ月|ヵ月)後?$/
const PRICE_YEN_RE = /^(\d+)円$/
const PRICE_DIGITS_RE = /^\d{4,6}$/
const HONORIFIC_RE = /(さん|さま|様|ちゃん|くん|君)$/
const DIGITS_ONLY_RE = /^\d+$/

/** 「8,800」のような桁区切りのカンマを外す（区切り文字の「,」で金額が割れないように） */
function removeThousandsSeparators(s: string): string {
  let prev: string
  let cur = s
  do {
    prev = cur
    cur = cur.replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
  } while (cur !== prev)
  return cur
}

interface MenuKey {
  key: string
  menuId: ID
}

function buildMenuKeys(menus: readonly Menu[]): MenuKey[] {
  const keys: MenuKey[] = []
  for (const m of menus) {
    for (const k of [m.name, ...m.aliases]) {
      const key = matchKey(k)
      if (key) keys.push({ key, menuId: m.id })
    }
  }
  return keys.sort((a, b) => b.key.length - a.key.length)
}

/** 語全体をメニュー名・別名に切り分ける（先頭から最長一致、間の「と」は読み飛ばす）。切り分けられなければ null */
export function segmentMenus(token: string, menus: readonly Menu[]): ID[] | null {
  const keys = buildMenuKeys(menus)
  const s = matchKey(token)
  if (!s) return null
  const found: ID[] = []
  let pos = 0
  while (pos < s.length) {
    const hit = keys.find((k) => s.startsWith(k.key, pos))
    if (hit) {
      if (!found.includes(hit.menuId)) found.push(hit.menuId)
      pos += hit.key.length
      continue
    }
    if (s[pos] === 'と' && found.length > 0 && pos + 1 < s.length) {
      pos += 1
      continue
    }
    return null
  }
  return found.length ? found : null
}

/** 名前の語に前方一致する客（完全一致が先頭、あとは五十音順） */
export function matchCustomers(token: string, customers: readonly Customer[]): Customer[] {
  const key = matchKey(token)
  const hits = customers.filter((c) => !c.deletedAt && nameStartsWith(c.nickname, c.kana, token))
  return hits.sort((a, b) => {
    const ea = matchKey(a.nickname) === key || (a.kana ? matchKey(a.kana) === key : false)
    const eb = matchKey(b.nickname) === key || (b.kana ? matchKey(b.kana) === key : false)
    if (ea !== eb) return ea ? -1 : 1
    return compareNames(a, b)
  })
}

/**
 * parseOneLine（6.11）
 * @param input 1行の文字列
 * @param visitDate 来店日 V
 * @param customers 顧客一覧
 * @param menus メニュー一覧
 * @param selectedCustomer 選択済みの客（名前の語がないときに使う）
 */
export function parseOneLine(
  input: string,
  visitDate: ISODate,
  customers: readonly Customer[],
  menus: readonly Menu[],
  selectedCustomer?: Customer,
): OneLineResult {
  const result: OneLineResult = { customerMatches: [], menuIds: [], unparsed: [], warnings: [] }
  const normalized = removeThousandsSeparators(nfkc(input))
  const tokens = normalized.split(SEPARATORS).filter((t) => t !== '')
  const V = parseISODate(visitDate)
  let nextCount = 0
  let nameDecided = false

  const setNext = (n: NextPlan) => {
    nextCount++
    result.next = n
  }

  for (const tok of tokens) {
    // a. 予約日
    const dm = DATE_RE.exec(tok)
    if (dm) {
      const mon = Number(dm[1])
      const day = Number(dm[2])
      const year = mon < V.m || (mon === V.m && day < V.d) ? V.y + 1 : V.y
      if (!isValidYMD(year, mon, day)) {
        result.unparsed.push(tok)
        continue
      }
      const date = toISODate(year, mon, day)
      if (date === visitDate) {
        result.unparsed.push(tok)
        if (!result.warnings.includes(ONE_LINE_WARNINGS.bookedSameDay)) result.warnings.push(ONE_LINE_WARNINGS.bookedSameDay)
        continue
      }
      setNext({ kind: 'booked', date })
      continue
    }
    // b. 目安（週）
    const wm = WEEK_RE.exec(tok)
    if (wm) {
      const n = Number(wm[1])
      if (n >= 1 && n <= 26) setNext({ kind: 'agreed', amount: n, unit: 'week' })
      else result.unparsed.push(tok)
      continue
    }
    // c. 目安（月）
    const mm = MONTH_RE.exec(tok)
    if (mm) {
      const n = Number(mm[1])
      if (n >= 1 && n <= 12) setNext({ kind: 'agreed', amount: n, unit: 'month' })
      else result.unparsed.push(tok)
      continue
    }
    // d. おまかせ
    if (matchKey(tok) === 'おまかせ') {
      setNext({ kind: 'omakase' })
      continue
    }
    // e. 金額
    const pm = PRICE_YEN_RE.exec(tok)
    if (pm || PRICE_DIGITS_RE.test(tok)) {
      result.price = Number(pm ? pm[1] : tok)
      continue
    }
    // f. メニュー
    const seg = segmentMenus(tok, menus)
    if (seg) {
      for (const id of seg) if (!result.menuIds.includes(id)) result.menuIds.push(id)
      continue
    }
    // g. 名前
    if (!nameDecided && !DIGITS_ONLY_RE.test(tok)) {
      const stripped = tok.replace(HONORIFIC_RE, '')
      if (stripped !== '') {
        nameDecided = true
        result.nameToken = stripped
        result.customerMatches = matchCustomers(stripped, customers)
        continue
      }
    }
    // h. 読み取れなかった語
    result.unparsed.push(tok)
  }

  if (nextCount > 1) result.warnings.unshift(ONE_LINE_WARNINGS.multipleNext)
  if (!nameDecided && selectedCustomer) result.customerMatches = [selectedCustomer]
  return result
}
