import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  addWeeks,
  approxDateForMonth,
  daysBetween,
  endOfPreviousMonth,
  formatDateWithWeekday,
  isValidISODate,
  localDateOf,
  todayLocal,
  weekdayJa,
} from './dates'

describe('6.1 日付の基本', () => {
  it('daysBetween は b − a の日数', () => {
    expect(daysBetween('2026-08-22', '2026-11-07')).toBe(77)
    expect(daysBetween('2026-11-07', '2026-08-22')).toBe(-77)
    expect(daysBetween('2026-09-08', '2026-11-07')).toBe(60)
    expect(daysBetween('2026-07-31', '2026-11-07')).toBe(99)
    // 夏時間のある地域の切り替え日をまたいでも日数がずれない（UTCで計算）
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
    expect(daysBetween('2026-10-20', '2026-11-10')).toBe(21)
  })

  it('addWeeks は 7n 日後', () => {
    expect(addWeeks('2026-11-07', 6)).toBe('2026-12-19')
    expect(addWeeks('2026-11-02', 6)).toBe('2026-12-14')
  })

  it('addMonths は同じ日付の n か月後（なければ月末）', () => {
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30')
    expect(addMonths('2026-12-31', 2)).toBe('2027-02-28')
    expect(addMonths('2026-11-07', 2)).toBe('2027-01-07')
    expect(addMonths('2026-08-31', 2)).toBe('2026-10-31')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15')
  })

  it('曜日と表示', () => {
    expect(weekdayJa('2026-11-07')).toBe('土')
    expect(weekdayJa('2026-12-19')).toBe('土')
    expect(formatDateWithWeekday('2026-08-22')).toBe('2026-08-22（土）')
  })

  it('ローカル日付の今日', () => {
    expect(todayLocal(new Date(2026, 10, 7, 23, 59))).toBe('2026-11-07')
    expect(todayLocal(new Date(2026, 10, 8, 0, 0))).toBe('2026-11-08')
    expect(localDateOf(new Date(2026, 9, 24, 12).toISOString())).toBe('2026-10-24')
  })

  it('その他', () => {
    expect(addDays('2026-11-07', -126)).toBe('2026-07-04')
    expect(endOfPreviousMonth('2026-11-07')).toBe('2026-10-31')
    expect(endOfPreviousMonth('2027-01-05')).toBe('2026-12-31')
    expect(approxDateForMonth(2026, 7, '2026-11-07')).toBe('2026-07-31')
    expect(approxDateForMonth(2026, 11, '2026-11-07')).toBe('2026-11-07')
    expect(isValidISODate('2026-02-29')).toBe(false)
    expect(isValidISODate('2028-02-29')).toBe(true)
    expect(isValidISODate('2026-11-7')).toBe(false)
  })
})
