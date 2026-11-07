/** 記録の鮮度とバックアップの催促（仕様 6.8）、ホームのお知らせ帯（4.2 の 1） */
import { addDays, daysBetween, localDateOf } from './dates'
import type { Customer, ISODate, LocalCounters, Settings, Visit } from './types'

export interface NoticeState {
  show: boolean
  /** 経過日数（表示に使う） */
  days: number
}

/** 最後の記録日 R = source ≠ 'bulk' の来店記録の日付の最大値（なければ counters.firstUsedOn） */
export function lastRecordDate(visits: readonly Visit[], counters: Pick<LocalCounters, 'firstUsedOn'>, today: ISODate): ISODate {
  let max: ISODate | undefined
  for (const v of visits) {
    if (v.deletedAt || v.source === 'bulk' || v.date > today) continue
    if (!max || v.date > max) max = v.date
  }
  return max ?? counters.firstUsedOn
}

/** 記録停止の表示（6.8） */
export function recordStaleness(input: {
  customers: readonly Customer[]
  visits: readonly Visit[]
  counters: Pick<LocalCounters, 'firstUsedOn'>
  settings: Pick<Settings, 'staleRecordDays' | 'staleDismissedUntil'>
  today: ISODate
  isSample: boolean
}): NoticeState {
  const { customers, visits, counters, settings, today, isSample } = input
  const R = lastRecordDate(visits, counters, today)
  const days = daysBetween(R, today)
  const hasCustomer = customers.some((c) => !c.deletedAt)
  const dismissed = !!settings.staleDismissedUntil && today <= settings.staleDismissedUntil
  const show = !isSample && hasCustomer && days > settings.staleRecordDays && !dismissed
  return { show, days }
}

/** ［休みでした］: staleDismissedUntil = T + 7 */
export function staleDismissUntil(today: ISODate): ISODate {
  return addDays(today, 7)
}

/** バックアップの基準日 B = lastBackupAt の日付（なければ counters.firstUsedOn） */
export function backupBaseDate(
  settings: Pick<Settings, 'lastBackupAt'>,
  counters: Pick<LocalCounters, 'firstUsedOn'>,
): ISODate {
  return settings.lastBackupAt ? localDateOf(settings.lastBackupAt) : counters.firstUsedOn
}

/** バックアップの催促（6.8） */
export function backupReminder(input: {
  settings: Pick<Settings, 'lastBackupAt' | 'backupReminderDays'>
  counters: Pick<LocalCounters, 'firstUsedOn'>
  today: ISODate
  isSample: boolean
}): NoticeState {
  const { settings, counters, today, isSample } = input
  const days = daysBetween(backupBaseDate(settings, counters), today)
  return { show: !isSample && days > settings.backupReminderDays, days }
}

/** ホーム画面への追加の案内は、使い始めてから7日間だけ */
export const INSTALL_NOTICE_DAYS = 7

export type HomeNotice =
  | { kind: 'stale'; days: number; text: string }
  | { kind: 'backup'; days: number; text: string }
  | { kind: 'install'; text: string }

/** お知らせ帯（優先順に1つ）: 記録停止 → バックアップ → ホーム画面に追加 */
export function homeNotice(input: {
  customers: readonly Customer[]
  visits: readonly Visit[]
  counters: Pick<LocalCounters, 'firstUsedOn'>
  settings: Pick<Settings, 'staleRecordDays' | 'staleDismissedUntil' | 'lastBackupAt' | 'backupReminderDays'>
  today: ISODate
  isSample: boolean
  /** ホーム画面から開いている（display-mode: standalone）か */
  isStandalone?: boolean
}): HomeNotice | null {
  const stale = recordStaleness(input)
  if (stale.show) {
    return { kind: 'stale', days: stale.days, text: `記録が止まっています（最後の来店記録から${stale.days}日）` }
  }
  const backup = backupReminder(input)
  if (backup.show) {
    return { kind: 'backup', days: backup.days, text: `最後のバックアップから${backup.days}日` }
  }
  if (!input.isStandalone && daysBetween(input.counters.firstUsedOn, input.today) < INSTALL_NOTICE_DAYS) {
    return { kind: 'install', text: 'ホーム画面に追加すると、データが消えにくくなります' }
  }
  return null
}

/** 声かけ画面の「記録が止まっています」（4.5 の 2）: 最後の来店記録から8日以上 */
export function isRecordStaleForKoekake(
  visits: readonly Visit[],
  counters: Pick<LocalCounters, 'firstUsedOn'>,
  settings: Pick<Settings, 'staleRecordDays'>,
  today: ISODate,
): boolean {
  return daysBetween(lastRecordDate(visits, counters, today), today) > settings.staleRecordDays
}
