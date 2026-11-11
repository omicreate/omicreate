/** ざっくり登録の最終来店（仕様 6.12） */
import { approxDateForMonth, isValidYMD, parseISODate, toISODate } from './dates'
import { nfkc } from './text'
import type { ISODate } from './types'

export type LastVisitParse =
  | { kind: 'empty' } // 来店記録を作らない（status は no_data）
  | { kind: 'date'; date: ISODate; approx: boolean } // approx = 年月だけ（dateApprox 'month'）
  | { kind: 'error'; message: string }

export const LAST_VISIT_ERROR = '読み取れませんでした（例: 8月、2026-08、8/22）'

const EMPTY_WORDS = new Set(['', '不明', 'ふめい', 'わからない', '?', '-'])
const MONTH_ONLY_RE = /^(\d{1,2})月$/
const YEAR_MONTH_RE = /^(\d{4})[-/年](\d{1,2})月?$/
const MONTH_DAY_RE = /^(\d{1,2})[/月](\d{1,2})日?$/
const FULL_DATE_RE = /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?$/

/**
 * 「8月」「2026-08」「2026/8」→ その月の末日（当月は今日、今日より後の月は前年）、おおよそ。
 * 「8/22」「2026/8/22」「2026-08-22」→ その日、正確（年のない日付が今日より後なら前年）。
 * 空欄・不明 → 来店記録を作らない。読めなければエラー。
 */
export function parseLastVisitInput(input: string, today: ISODate): LastVisitParse {
  const s = nfkc(input ?? '').replace(/\s+/g, '')
  if (EMPTY_WORDS.has(s)) return { kind: 'empty' }
  const T = parseISODate(today)
  const err: LastVisitParse = { kind: 'error', message: LAST_VISIT_ERROR }

  let m = MONTH_ONLY_RE.exec(s)
  if (m) {
    const mon = Number(m[1])
    if (mon < 1 || mon > 12) return err
    const year = mon > T.m ? T.y - 1 : T.y
    return { kind: 'date', date: approxDateForMonth(year, mon, today), approx: true }
  }

  m = YEAR_MONTH_RE.exec(s)
  if (m) {
    const year = Number(m[1])
    const mon = Number(m[2])
    if (mon < 1 || mon > 12) return err
    if (year > T.y || (year === T.y && mon > T.m)) return err
    return { kind: 'date', date: approxDateForMonth(year, mon, today), approx: true }
  }

  m = FULL_DATE_RE.exec(s)
  if (m) {
    const year = Number(m[1])
    const mon = Number(m[2])
    const day = Number(m[3])
    if (!isValidYMD(year, mon, day)) return err
    const date = toISODate(year, mon, day)
    if (date > today) return err
    return { kind: 'date', date, approx: false }
  }

  m = MONTH_DAY_RE.exec(s)
  if (m) {
    const mon = Number(m[1])
    const day = Number(m[2])
    const year = mon > T.m || (mon === T.m && day > T.d) ? T.y - 1 : T.y
    if (!isValidYMD(year, mon, day)) return err
    return { kind: 'date', date: toISODate(year, mon, day), approx: false }
  }

  return err
}
