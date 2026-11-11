/**
 * 日付の基本（仕様 6.1）。
 * 日付は端末のローカル日付の文字列 'YYYY-MM-DD' で扱い、計算は Date.UTC に直して行う。
 * これで夏時間やタイムゾーンの影響を受けない。
 */
import type { ISODate, ISODateTime } from './types'

const MS_PER_DAY = 86_400_000
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export interface YMD {
  y: number
  m: number // 1〜12
  d: number // 1〜31
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 'YYYY-MM-DD' を年・月・日に分ける。形式が違えば例外 */
export function parseISODate(date: ISODate): YMD {
  const m = ISO_DATE_RE.exec(date)
  if (!m) throw new Error(`日付の形式が違います: ${date}`)
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

/** 年・月・日から 'YYYY-MM-DD' を作る（妥当性は見ない） */
export function toISODate(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`
}

/** その月の日数 */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** 実在する日付か */
export function isValidYMD(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false
  if (y < 1 || m < 1 || m > 12 || d < 1) return false
  return d <= daysInMonth(y, m)
}

/** 'YYYY-MM-DD' として正しく、実在する日付か */
export function isValidISODate(date: unknown): date is ISODate {
  if (typeof date !== 'string') return false
  const m = ISO_DATE_RE.exec(date)
  if (!m) return false
  return isValidYMD(Number(m[1]), Number(m[2]), Number(m[3]))
}

function toUTCms(date: ISODate): number {
  const { y, m, d } = parseISODate(date)
  return Date.UTC(y, m - 1, d)
}

function fromUTCms(ms: number): ISODate {
  const dt = new Date(ms)
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** daysBetween(a, b) = b − a（日数）。a より b が後なら正 */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTCms(b) - toUTCms(a)) / MS_PER_DAY)
}

/** d + n 日 */
export function addDays(d: ISODate, n: number): ISODate {
  return fromUTCms(toUTCms(d) + n * MS_PER_DAY)
}

/** d + 7n 日 */
export function addWeeks(d: ISODate, n: number): ISODate {
  return addDays(d, 7 * n)
}

/** 同じ日付の n か月後。その月にその日がなければ月末にそろえる */
export function addMonths(d: ISODate, n: number): ISODate {
  const { y, m, d: day } = parseISODate(d)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12 + 12) % 12 + 1
  return toISODate(ny, nm, Math.min(day, daysInMonth(ny, nm)))
}

/** 端末のローカル日付で今日（または与えた時刻の日付） */
export function todayLocal(now: Date = new Date()): ISODate {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** ISO 8601 の日時を、端末のローカル日付に直す */
export function localDateOf(dateTime: ISODateTime): ISODate {
  return todayLocal(new Date(dateTime))
}

/** 今の日時（ISO 8601） */
export function nowISO(now: Date = new Date()): ISODateTime {
  return now.toISOString()
}

/** 曜日の1文字（日〜土） */
export function weekdayJa(d: ISODate): string {
  return WEEKDAYS[new Date(toUTCms(d)).getUTCDay()]
}

/** 'YYYY-MM-DD（曜）' 例: 2026-08-22（土） */
export function formatDateWithWeekday(d: ISODate): string {
  return `${d}（${weekdayJa(d)}）`
}

/** 'M/D' 例: 11/4 */
export function formatMonthDay(d: ISODate): string {
  const { m, d: day } = parseISODate(d)
  return `${m}/${day}`
}

/** 'M月D日' 例: 12月19日 */
export function formatMonthDayJa(d: ISODate): string {
  const { m, d: day } = parseISODate(d)
  return `${m}月${day}日`
}

/** 'YYYY年M月' 例: 2026年7月（おおよその最終来店の表示） */
export function formatYearMonthJa(d: ISODate): string {
  const { y, m } = parseISODate(d)
  return `${y}年${m}月`
}

/** 'YYYY-MM' */
export function monthKey(d: ISODate): string {
  return d.slice(0, 7)
}

/** その月の末日 */
export function endOfMonth(d: ISODate): ISODate {
  const { y, m } = parseISODate(d)
  return toISODate(y, m, daysInMonth(y, m))
}

/** 先月の末日 */
export function endOfPreviousMonth(d: ISODate): ISODate {
  const { y, m } = parseISODate(d)
  return addDays(toISODate(y, m, 1), -1)
}

/** 'YYYY-MM' の n か月後（負なら前） */
export function addMonthsToKey(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12 + 12) % 12 + 1
  return `${String(ny).padStart(4, '0')}-${pad2(nm)}`
}

/** 年月だけの来店日: その月の末日。当月なら今日（仕様 5.1・6.12） */
export function approxDateForMonth(y: number, m: number, today: ISODate): ISODate {
  const t = parseISODate(today)
  if (t.y === y && t.m === m) return today
  return toISODate(y, m, daysInMonth(y, m))
}

/** ローカル日付の正午の時刻（ISO 8601）。サンプルデータの作成日時などに使う */
export function localNoonISO(d: ISODate): ISODateTime {
  const { y, m, d: day } = parseISODate(d)
  return new Date(y, m - 1, day, 12, 0, 0, 0).toISOString()
}
