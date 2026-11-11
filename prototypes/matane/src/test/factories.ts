/** 単体テスト用の小さな作り手（テストの中だけで使う） */
import {
  addDays,
  createDefaultMenus,
  createDefaultSettings,
  localNoonISO,
  NOTICE_VERSION,
  type ContactLog,
  type Customer,
  type ISODate,
  type Settings,
  type Visit,
} from '../domain'

/** テストで固定する今日 */
export const T: ISODate = '2026-11-07'

export const MENUS = createDefaultMenus()

export function settings(patch: Partial<Settings> = {}): Settings {
  return { ...createDefaultSettings({ version: NOTICE_VERSION, ackedAt: '2026-11-07T00:00:00.000Z' }), ...patch }
}

export function cust(id: string, patch: Partial<Customer> = {}): Customer {
  return {
    id,
    nickname: id,
    stewardship: { steward: 'self', channel: 'own_line', decidedOn: '2026-01-01' },
    contact: { permission: 'ok' },
    createdAt: '2026-01-01T03:00:00.000Z',
    updatedAt: '2026-01-01T03:00:00.000Z',
    ...patch,
  }
}

let seq = 0

export function visit(customerId: string, date: ISODate, patch: Partial<Visit> = {}): Visit {
  seq++
  return {
    id: `v-${customerId}-${date}-${seq}`,
    customerId,
    date,
    menuIds: ['color'],
    next: { kind: 'omakase' },
    source: 'checkout',
    createdAt: localNoonISO(date),
    updatedAt: localNoonISO(date),
    ...patch,
  }
}

/**
 * 間隔の並び（古い順）から来店記録を作る。最後の来店日が lastDate になる。
 * gaps = [56, 56] → lastDate−112, lastDate−56, lastDate の3回
 */
export function visitsFromGaps(customerId: string, gaps: readonly number[], lastDate: ISODate, patch: Partial<Visit> = {}): Visit[] {
  const total = gaps.reduce((a, b) => a + b, 0)
  let d = addDays(lastDate, -total)
  const out = [visit(customerId, d, patch)]
  for (const g of gaps) {
    d = addDays(d, g)
    out.push(visit(customerId, d, patch))
  }
  return out
}

export function koekake(customerId: string, date: ISODate, patch: Partial<ContactLog> = {}): ContactLog {
  seq++
  return {
    id: `k-${customerId}-${date}-${seq}`,
    customerId,
    date,
    kind: 'koekake',
    via: 'line_link',
    createdAt: localNoonISO(date),
    ...patch,
  }
}
