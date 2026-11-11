/** バックアップの中身（BackupPayload）の組み立てと確かめ（5.1・7.4） */
import { isValidISODate } from './dates'
import type {
  BackupPayload,
  ContactLog,
  Customer,
  ID,
  LocalCounters,
  Menu,
  MessageTemplate,
  Settings,
  Visit,
} from './types'

export interface PayloadSource {
  customers: readonly Customer[]
  visits: readonly Visit[]
  menus: readonly Menu[]
  contacts: readonly ContactLog[]
  templates: readonly MessageTemplate[]
  settings: Settings | Omit<Settings, 'lock'>
  counters: LocalCounters
}

/** 設定から PIN を除く（PINは端末ごとのもの） */
export function settingsWithoutLock(settings: Settings | Omit<Settings, 'lock'>): Omit<Settings, 'lock'> {
  const { lock: _lock, ...rest } = settings as Settings
  void _lock
  return rest
}

/** BackupPayload を作る（削除印つきは含めない） */
export function buildBackupPayload(src: PayloadSource): BackupPayload {
  const customers = src.customers.filter((c) => !c.deletedAt)
  const alive = new Set(customers.map((c) => c.id))
  return {
    schemaVersion: 1,
    customers: customers.map((c) => ({ ...c })),
    visits: src.visits.filter((v) => !v.deletedAt && alive.has(v.customerId)).map((v) => ({ ...v })),
    menus: src.menus.map((m) => ({ ...m })),
    contacts: src.contacts.filter((c) => !c.deletedAt && alive.has(c.customerId)).map((c) => ({ ...c })),
    templates: src.templates.map((t) => ({ ...t })),
    settings: settingsWithoutLock(src.settings),
    counters: { ...src.counters },
  }
}

/** 平文の書き出し用: 所属サロンの顧客とその来店・連絡の記録を除く（7.3・7.4） */
export function withoutSalonCustomers(payload: BackupPayload): BackupPayload {
  const salonIds = new Set<ID>(payload.customers.filter((c) => c.stewardship.steward === 'salon').map((c) => c.id))
  return {
    ...payload,
    customers: payload.customers.filter((c) => !salonIds.has(c.id)),
    visits: payload.visits.filter((v) => !salonIds.has(v.customerId)),
    contacts: payload.contacts.filter((c) => !salonIds.has(c.customerId)),
  }
}

export type PayloadCheck = { ok: true; payload: BackupPayload } | { ok: false; reason: 'corrupt' | 'newer_version' }

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isStr(x: unknown): x is string {
  return typeof x === 'string'
}

/** 読み込んだ BackupPayload の形を確かめる（将来の版は newer_version） */
export function validateBackupPayload(x: unknown): PayloadCheck {
  if (!isObj(x)) return { ok: false, reason: 'corrupt' }
  if (typeof x.schemaVersion !== 'number') return { ok: false, reason: 'corrupt' }
  if (x.schemaVersion > 1) return { ok: false, reason: 'newer_version' }
  if (x.schemaVersion !== 1) return { ok: false, reason: 'corrupt' }
  const arrays = ['customers', 'visits', 'menus', 'contacts', 'templates'] as const
  for (const k of arrays) if (!Array.isArray(x[k])) return { ok: false, reason: 'corrupt' }
  if (!isObj(x.settings) || !isObj(x.counters)) return { ok: false, reason: 'corrupt' }

  const customers = x.customers as unknown[]
  for (const c of customers) {
    if (!isObj(c) || !isStr(c.id) || !isStr(c.nickname)) return { ok: false, reason: 'corrupt' }
    if (!isObj(c.stewardship) || !isObj(c.contact)) return { ok: false, reason: 'corrupt' }
    // あとから入れた予約（S10）。古いバックアップにはないので、あるときだけ形を確かめる
    if (c.booking !== undefined && (!isObj(c.booking) || !isValidISODate(c.booking.date) || !isStr(c.booking.setAt))) {
      return { ok: false, reason: 'corrupt' }
    }
  }
  for (const v of x.visits as unknown[]) {
    if (!isObj(v) || !isStr(v.id) || !isStr(v.customerId) || !isValidISODate(v.date)) return { ok: false, reason: 'corrupt' }
    if (!Array.isArray(v.menuIds) || !isObj(v.next)) return { ok: false, reason: 'corrupt' }
  }
  for (const m of x.menus as unknown[]) {
    if (!isObj(m) || !isStr(m.id) || !isStr(m.name)) return { ok: false, reason: 'corrupt' }
  }
  for (const c of x.contacts as unknown[]) {
    if (!isObj(c) || !isStr(c.id) || !isStr(c.customerId) || !isValidISODate(c.date)) return { ok: false, reason: 'corrupt' }
  }
  for (const t of x.templates as unknown[]) {
    if (!isObj(t) || (t.kind !== 'koekake' && t.kind !== 'matane') || !isStr(t.body)) return { ok: false, reason: 'corrupt' }
  }
  const s = x.settings
  if (typeof s.schemaVersion === 'number' && s.schemaVersion > 1) return { ok: false, reason: 'newer_version' }
  if (!isObj(s.thresholds) || typeof s.globalDefaultIntervalDays !== 'number') return { ok: false, reason: 'corrupt' }
  if (!isValidISODate(x.counters.firstUsedOn)) return { ok: false, reason: 'corrupt' }
  const payload = { ...(x as unknown as BackupPayload) }
  // 念のため PIN が入っていても取り除く
  payload.settings = settingsWithoutLock(payload.settings)
  return { ok: true, payload }
}
