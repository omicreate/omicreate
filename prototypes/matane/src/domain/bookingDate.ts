/**
 * 予約日の読み取り（S10「予約を入れる」）。LINE・Instagram の文の貼り付け、手入力、キーボードの音声入力から日付だけを読む。
 * 時刻は読み取っても捨てる。貼った文そのものは保存しない（ここは純粋関数で、何も残さない）。
 *
 * 読む書き方（全角は半角にそろえてから読む。前後に文字があってもよい）:
 *  - 2026-11-20, 2026/11/20, 2026年11月20日, 11/20, 11月20日, 20日（今月。今日より前なら来月）
 *  - 今日, 本日, 明日, あした, 明後日, あさって
 *  - 来週火曜／来週の火曜日／来週(火)（来週＝次の月曜から始まる週）。再来週火曜はその7日あと
 *  - 今月20日／来月20日／来月の5日／再来月10日
 *  - 火曜／火曜日（今日以降で最初のその曜日。今日がその曜日なら今日）
 *  - 年のない月日は今年。今日より前なら、来年のその日が半年以内のときだけ来年。それ以外は過去のエラー
 *  - 「3日後」「2週間後」「先週の火曜」「先月」のような数えて決める言い方は読めない扱い（カレンダーへ促す）
 * 範囲は今日〜365日先。
 */
import { addDays, daysBetween, isValidYMD, parseISODate, toISODate, weekdayJa } from './dates'
import type { ISODate } from './types'

/** 予約として入れられるのは今日から何日先まで */
export const BOOKING_MAX_DAYS = 365

export type BookingDateError = 'empty' | 'unreadable' | 'past' | 'too_far'

export interface BookingDateParse {
  /** 読み取った日付（範囲外でも、読み取れたら入れる） */
  date: ISODate | null
  /** null なら保存できる */
  error: BookingDateError | null
  /** 時刻を読み取って捨てた */
  timeDropped: boolean
  /** 違う日付が2つ以上あった（最初のものを使った） */
  multiple: boolean
}

export const BOOKING_DATE_MESSAGES = {
  unreadable: '日付が読み取れませんでした。カレンダーで選んでください',
  past: '過去の日付は入れられません。カレンダーで選び直してください',
  tooFar: '1年より先の日付は入れられません',
  multiple: '日付が2つありました。合っているか確かめてください',
  timeDropped: '時刻は残しません',
} as const

/** 予約日の範囲のエラー（今日〜365日先なら null） */
export function bookingDateRangeError(date: ISODate, today: ISODate): 'past' | 'too_far' | null {
  if (date < today) return 'past'
  if (daysBetween(today, date) > BOOKING_MAX_DAYS) return 'too_far'
  return null
}

/** エラーの文言（empty は文言なし） */
export function bookingDateErrorMessage(error: BookingDateError | null): string | null {
  switch (error) {
    case 'unreadable':
      return BOOKING_DATE_MESSAGES.unreadable
    case 'past':
      return BOOKING_DATE_MESSAGES.past
    case 'too_far':
      return BOOKING_DATE_MESSAGES.tooFar
    default:
      return null
  }
}

const WD = '日月火水木金土'

function weekdayIndex(d: ISODate): number {
  return WD.indexOf(weekdayJa(d))
}

/** 今日以降で最初のその曜日（今日がその曜日なら今日） */
function nextWeekdayOnOrAfter(today: ISODate, wd: number): ISODate {
  return addDays(today, (wd - weekdayIndex(today) + 7) % 7)
}

/** 来週（次の月曜から始まる週）のその曜日 */
function weekdayNextWeek(today: ISODate, wd: number): ISODate {
  const dow = weekdayIndex(today) // 日=0
  const toMonday = dow === 0 ? 1 : 8 - dow
  const monday = addDays(today, toMonday)
  const offset = wd === 0 ? 6 : wd - 1 // 月=0 … 日=6
  return addDays(monday, offset)
}

/** 年のない月日を来年として読むのは、来年のその日が今日から何日先までのとき（それより先なら、今年の過ぎた日＝エラー） */
const NEXT_YEAR_WITHIN_DAYS = 183

/**
 * 年のない月日: 今年。今日より前なら、来年のその日が半年以内のときだけ来年（11月に「1月10日」→来年）。
 * それ以外（11/7 に「11月1日」など）は今年の過ぎた日として返し、過去のエラーにする（打ち間違い・聞き間違いを1年先の予約にしない）。
 * 実在しなければ null
 */
function monthDayFromToday(m: number, d: number, today: ISODate): ISODate | null {
  const t = parseISODate(today)
  const thisYear = isValidYMD(t.y, m, d) ? toISODate(t.y, m, d) : null
  if (thisYear && thisYear >= today) return thisYear
  const nextYear = isValidYMD(t.y + 1, m, d) ? toISODate(t.y + 1, m, d) : null
  if (nextYear && daysBetween(today, nextYear) <= NEXT_YEAR_WITHIN_DAYS) return nextYear
  return thisYear ?? nextYear
}

/** 今月（offset=0）・来月（1）・再来月（2）の d 日。実在しなければ null */
function dayOfMonthOffset(d: number, offset: number, today: ISODate): ISODate | null {
  const t = parseISODate(today)
  const total = t.y * 12 + (t.m - 1) + offset
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return isValidYMD(y, m, d) ? toISODate(y, m, d) : null
}

/** 日だけ: 今月。今日より前（または今月にない日）なら来月、それもなければ再来月 */
function dayFromToday(d: number, today: ISODate): ISODate | null {
  const t = parseISODate(today)
  for (let i = 0; i < 3; i++) {
    const total = t.y * 12 + (t.m - 1) + i
    const y = Math.floor(total / 12)
    const m = (total % 12) + 1
    if (!isValidYMD(y, m, d)) continue
    const iso = toISODate(y, m, d)
    if (iso >= today) return iso
  }
  return null
}

interface Hit {
  index: number
  /** null は「日付らしいが実在しない」 */
  date: ISODate | null
}

/** 全角の数字・記号を半角にそろえる（NFKC）。波線などはそのまま */
function normalizeText(text: string): string {
  return text.normalize('NFKC')
}

/** 一致した部分を同じ長さの空白で消す（位置を保ったまま、次の書き方で二重に読まないように） */
function mask(s: string, start: number, length: number): string {
  return s.slice(0, start) + ' '.repeat(length) + s.slice(start + length)
}

const TIME_RE = /(午前|午後|朝|夜|夕方)?\s*\d{1,2}\s*(?::\s*\d{2}|時(?:\s*\d{1,2}\s*分|半)?)(?:\s*(?:から|~|〜|-)\s*(?:\d{1,2}\s*(?::\s*\d{2}|時(?:\s*\d{1,2}\s*分|半)?)?))?/g

const WD_CLASS = '[日月火水木金土]'

/**
 * 予約日を読み取る。today は端末の今日（引数で受け取る）。
 */
export function parseBookingDate(text: string, today: ISODate): BookingDateParse {
  const raw = normalizeText(text ?? '')
  if (!raw.trim()) return { date: null, error: 'empty', timeDropped: false, multiple: false }

  let s = raw
  const hits: Hit[] = []
  /** toDate が undefined を返したら、日付として数えずに消すだけ */
  const take = (re: RegExp, toDate: (m: RegExpExecArray) => ISODate | null | undefined) => {
    re.lastIndex = 0
    const found: RegExpExecArray[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(s))) {
      found.push(m)
      if (m[0].length === 0) re.lastIndex++
    }
    for (const f of found) {
      const date = toDate(f)
      if (date !== undefined) hits.push({ index: f.index, date })
      s = mask(s, f.index, f[0].length)
    }
  }

  // 1. 年つきの日付（時刻より先に読む。2026-11-20 の「-20」を時刻の範囲と読まないように）
  take(/(?<!\d)(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?(?!\d)/g, (m) => {
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    return isValidYMD(y, mo, d) ? toISODate(y, mo, d) : null
  })

  // 2. 時刻は読み取っても捨てる（14時, 14:00, 午後2時, 14時半, 14時30分, 14:00〜15:00）
  let timeDropped = false
  TIME_RE.lastIndex = 0
  s = s.replace(TIME_RE, (m0) => {
    timeDropped = true
    return ' '.repeat(m0.length)
  })

  // 3. 月日
  take(/(?<!\d)(\d{1,2})\s*月\s*(\d{1,2})\s*日(?!\d)/g, (m) => monthDayFromToday(Number(m[1]), Number(m[2]), today))
  take(/(?<![\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/g, (m) => monthDayFromToday(Number(m[1]), Number(m[2]), today))
  // 4. 「3日後」「2週間後」「先週」「先月」のような、数えて決める言い方は読まない（日付として数えるが、読めない扱い）。
  //    「10日後」の「10日」を何日と読んだり、「先週の火曜」を今週の火曜と読んだりしないように
  take(
    new RegExp(
      `\\d+\\s*(?:日|週間?|か月|ヶ月|カ月|ケ月|ヵ月)\\s*(?:後|前|間|先|以内|ほど|くらい|ぐらい)|先週\\s*の?\\s*(?:${WD_CLASS}\\s*曜日?|\\(\\s*${WD_CLASS}\\s*\\))?|先月\\s*の?\\s*(?:\\d{1,2}\\s*日)?`,
      'g',
    ),
    () => null,
  )
  // 5. 今月・来月・再来月の何日（「来月20日」→来月の20日。「今月5日」が過ぎていれば過去のエラー）
  take(/(今月|再来月|来月)\s*の?\s*(\d{1,2})\s*日(?![\d曜])/g, (m) =>
    dayOfMonthOffset(Number(m[2]), m[1] === '今月' ? 0 : m[1] === '来月' ? 1 : 2, today),
  )
  // 6. 日だけ
  take(/(?<![\d月])(\d{1,2})\s*日(?![\d曜])/g, (m) => dayFromToday(Number(m[1]), today))
  // 7. ことば（明後日を明日より先に）
  take(/明後日|あさって/g, () => addDays(today, 2))
  take(/明日|あした/g, () => addDays(today, 1))
  take(/今日|本日/g, () => today)
  // 8. 来週・再来週の曜日（再来週＝来週の7日あと）
  take(new RegExp(`(再)?来週\\s*の?\\s*(?:(${WD_CLASS})\\s*曜日?|\\(\\s*(${WD_CLASS})\\s*\\))`, 'g'), (m) =>
    addDays(weekdayNextWeek(today, WD.indexOf(m[2] ?? m[3])), m[1] ? 7 : 0),
  )
  // 「来週」「再来週」だけで曜日がないものは、日が決まらないので読めない扱い
  take(/再?来週/g, () => null)
  // 9. 曜日だけ。「(金)」のように括弧だけの曜日や、「20日 金曜日」のように日付のすぐ後の曜日は、添え書きとして数えない
  take(new RegExp(`(${WD_CLASS})\\s*曜日?`, 'g'), (m) => {
    const before = raw.slice(0, m.index).replace(/[\s(、,]+$/, '')
    if (/[日\d]$/.test(before)) return undefined
    return nextWeekdayOnOrAfter(today, WD.indexOf(m[1]))
  })

  if (hits.length === 0) return { date: null, error: 'unreadable', timeDropped, multiple: false }
  hits.sort((a, b) => a.index - b.index)
  const distinct = new Set(hits.map((h) => h.date ?? `invalid:${h.index}`))
  const multiple = distinct.size > 1
  const first = hits[0].date
  if (!first) return { date: null, error: 'unreadable', timeDropped, multiple }
  return { date: first, error: bookingDateRangeError(first, today), timeDropped, multiple }
}
