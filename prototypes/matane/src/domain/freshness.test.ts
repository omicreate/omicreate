import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { backupReminder, homeNotice, lastRecordDate, recordStaleness, staleDismissUntil } from './freshness'
import { T, cust, settings, visit } from '../test/factories'
import type { Settings } from './types'

const counters = { firstUsedOn: '2026-01-01' }

function stale(lastRecord: string, s: Partial<Settings> = {}, today = T, isSample = false) {
  return recordStaleness({
    customers: [cust('a')],
    visits: [visit('a', lastRecord), visit('a', addDays(today, -1), { source: 'bulk' })],
    counters,
    settings: settings(s),
    today,
    isSample,
  })
}

/** ローカル日付 d の正午の時刻（タイムゾーンに関係なくその日になる） */
function localNoon(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day, 12).toISOString()
}

describe('6.8 記録の鮮度とバックアップの催促（AC-15）', () => {
  it('R = T − 7 → 表示しない', () => {
    expect(stale(addDays(T, -7))).toEqual({ show: false, days: 7 })
  })

  it('R = T − 8 →「記録が止まっています（8日）」', () => {
    expect(stale(addDays(T, -8))).toEqual({ show: true, days: 8 })
    const n = homeNotice({
      customers: [cust('a')],
      visits: [visit('a', addDays(T, -8))],
      counters,
      settings: settings({ lastBackupAt: localNoon(T) }),
      today: T,
      isSample: false,
    })
    expect(n).toEqual({ kind: 'stale', days: 8, text: '記録が止まっています（最後の来店記録から8日）' })
  })

  it('ざっくり登録（bulk）は最後の記録日に数えない。記録がなければ使い始めた日', () => {
    expect(lastRecordDate([visit('a', T, { source: 'bulk' })], counters, T)).toBe('2026-01-01')
  })

  it('［休みでした］で7日間出なくなる（T + 7 まで）', () => {
    const until = staleDismissUntil(T)
    expect(until).toBe('2026-11-14')
    const last = addDays(T, -8)
    expect(stale(last, { staleDismissedUntil: until }).show).toBe(false)
    expect(stale(last, { staleDismissedUntil: until }, '2026-11-14').show).toBe(false)
    expect(stale(last, { staleDismissedUntil: until }, '2026-11-15').show).toBe(true)
  })

  it('顧客が0人なら出さない', () => {
    const r = recordStaleness({ customers: [], visits: [], counters, settings: settings(), today: T, isSample: false })
    expect(r.show).toBe(false)
  })

  it('B = T − 14 → 表示しない、B = T − 15 →「最後のバックアップから15日」', () => {
    expect(backupReminder({ settings: settings({ lastBackupAt: localNoon(addDays(T, -14)) }), counters, today: T, isSample: false })).toEqual({
      show: false,
      days: 14,
    })
    expect(backupReminder({ settings: settings({ lastBackupAt: localNoon(addDays(T, -15)) }), counters, today: T, isSample: false })).toEqual({
      show: true,
      days: 15,
    })
    const n = homeNotice({
      customers: [cust('a')],
      visits: [visit('a', addDays(T, -1))],
      counters,
      settings: settings({ lastBackupAt: localNoon(addDays(T, -15)) }),
      today: T,
      isSample: false,
    })
    expect(n).toEqual({ kind: 'backup', days: 15, text: '最後のバックアップから15日' })
  })

  it('バックアップしたことがなければ使い始めた日から数える', () => {
    const r = backupReminder({ settings: settings(), counters: { firstUsedOn: addDays(T, -15) }, today: T, isSample: false })
    expect(r).toEqual({ show: true, days: 15 })
  })

  it('サンプル用データベースではどちらも出さない', () => {
    expect(stale(addDays(T, -30), {}, T, true).show).toBe(false)
    expect(backupReminder({ settings: settings(), counters, today: T, isSample: true }).show).toBe(false)
    const n = homeNotice({
      customers: [cust('a')],
      visits: [visit('a', addDays(T, -30))],
      counters,
      settings: settings(),
      today: T,
      isSample: true,
    })
    expect(n).toBeNull()
  })

  it('お知らせ帯の優先順: 記録停止 → バックアップ → ホーム画面に追加（初回から7日間）', () => {
    const base = { customers: [cust('a')], settings: settings(), today: T, isSample: false }
    const both = homeNotice({ ...base, visits: [visit('a', addDays(T, -9))], counters: { firstUsedOn: addDays(T, -30) } })
    expect(both?.kind).toBe('stale')
    const install = homeNotice({ ...base, visits: [visit('a', T)], counters: { firstUsedOn: addDays(T, -6) } })
    expect(install).toEqual({ kind: 'install', text: 'ホーム画面に追加すると、データが消えにくくなります' })
    const noInstall = homeNotice({ ...base, visits: [visit('a', T)], counters: { firstUsedOn: addDays(T, -7) } })
    expect(noInstall).toBeNull()
    const standalone = homeNotice({ ...base, visits: [visit('a', T)], counters: { firstUsedOn: T }, isStandalone: true })
    expect(standalone).toBeNull()
  })
})
