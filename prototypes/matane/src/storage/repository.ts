/**
 * 保存層（仕様 5.2・6.1）。各エンティティの保存・削除（deletedAt による取り消しと完全削除）、
 * 顧客削除時の来店・連絡の連鎖削除、下書き、カウンタ、RestorePoint、全件読み込み。
 * 書き込みは1つずつ順番に行う（読み込み→書き込みが重なって数字を取りこぼさないように）。
 */
import { IdbBackend, MemoryBackend, type Backend, type WriteOp } from './backend'
import { PROD_DB, SAMPLE_DB, getActiveDbName, type DbName } from './activeDb'
import { SINGLE_KEYS, defaultIdbFactory, deleteIdb } from './idb'
import type {
  BackupPayload,
  ContactLog,
  CounterKey,
  Customer,
  Draft,
  ID,
  ISODate,
  ISODateTime,
  LocalCounters,
  Menu,
  MessageTemplate,
  PinLock,
  RestorePoint,
  Settings,
  Visit,
} from '../domain'

export interface AppData {
  customers: Customer[]
  visits: Visit[]
  menus: Menu[]
  contacts: ContactLog[]
  templates: MessageTemplate[]
  /** S0 の［読みました］より前は null */
  settings: Settings | null
  counters: LocalCounters | null
}

export interface PurgeResult {
  customers: number
  visits: number
  contacts: number
}

/** IndexedDB が使えない（プライベートブラウズなど） */
export class StorageUnavailableError extends Error {
  readonly cause?: unknown
  constructor(cause?: unknown) {
    super('この状態では記録を保存できません。通常のブラウザで開くか、ホーム画面に追加してください')
    this.name = 'StorageUnavailableError'
    this.cause = cause
  }
}

function nowISO(): ISODateTime {
  return new Date().toISOString()
}

export class Repository {
  readonly dbName: DbName
  private readonly backend: Backend
  private queue: Promise<unknown> = Promise.resolve()

  constructor(dbName: DbName, backend: Backend) {
    this.dbName = dbName
    this.backend = backend
  }

  /** 端末に保存されるか（メモリ保存なら false） */
  get persistent(): boolean {
    return this.backend.kind === 'indexeddb'
  }

  get kind(): 'indexeddb' | 'memory' {
    return this.backend.kind
  }

  get isSample(): boolean {
    return this.dbName === SAMPLE_DB
  }

  /** 書き込みを順番に実行する */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => undefined)
    return run
  }

  private write(ops: WriteOp[]): Promise<void> {
    return this.backend.write(ops)
  }

  /* ========== 全件読み込み ========== */

  /** 全件読み込み。既定では削除印つき（取り消し待ち）を除く */
  async loadAll(options: { includeDeleted?: boolean } = {}): Promise<AppData> {
    const [customers, visits, menus, contacts, templates, settings, counters] = await Promise.all([
      this.backend.getAll<Customer>('customers'),
      this.backend.getAll<Visit>('visits'),
      this.backend.getAll<Menu>('menus'),
      this.backend.getAll<ContactLog>('contacts'),
      this.backend.getAll<MessageTemplate>('templates'),
      this.backend.get<Settings>('settings', SINGLE_KEYS.settings),
      this.backend.get<LocalCounters>('counters', SINGLE_KEYS.counters),
    ])
    const keep = <T extends { deletedAt?: string }>(x: T) => options.includeDeleted || !x.deletedAt
    return {
      customers: customers.filter(keep),
      visits: visits.filter(keep),
      menus: menus.sort((a, b) => a.order - b.order),
      contacts: contacts.filter(keep),
      templates,
      settings: settings ?? null,
      counters: counters ?? null,
    }
  }

  /* ========== 顧客 ========== */

  getCustomer(id: ID): Promise<Customer | undefined> {
    return this.backend.get<Customer>('customers', id)
  }

  putCustomer(c: Customer): Promise<void> {
    return this.serial(() => this.write([{ type: 'put', store: 'customers', value: c }]))
  }

  putCustomers(cs: readonly Customer[]): Promise<void> {
    return this.serial(() => this.write(cs.map((value) => ({ type: 'put' as const, store: 'customers' as const, value }))))
  }

  /* ========== 来店記録 ========== */

  getVisit(id: ID): Promise<Visit | undefined> {
    return this.backend.get<Visit>('visits', id)
  }

  /** その客の来店記録（削除印つきを除く） */
  async visitsOfCustomer(customerId: ID): Promise<Visit[]> {
    const list = await this.backend.getAllByIndex<Visit>('visits', 'customerId', customerId)
    return list.filter((v) => !v.deletedAt)
  }

  putVisit(v: Visit): Promise<void> {
    return this.serial(() => this.write([{ type: 'put', store: 'visits', value: v }]))
  }

  putVisits(vs: readonly Visit[]): Promise<void> {
    return this.serial(() => this.write(vs.map((value) => ({ type: 'put' as const, store: 'visits' as const, value }))))
  }

  /** 来店記録と顧客の更新（リストに戻すなど）を一度に保存する */
  saveVisitWithCustomer(v: Visit, c?: Customer): Promise<void> {
    const ops: WriteOp[] = [{ type: 'put', store: 'visits', value: v }]
    if (c) ops.push({ type: 'put', store: 'customers', value: c })
    return this.serial(() => this.write(ops))
  }

  /** 顧客と来店記録をまとめて保存する（ざっくり登録・まとめ記録） */
  saveRecords(input: { customers?: readonly Customer[]; visits?: readonly Visit[]; contacts?: readonly ContactLog[] }): Promise<void> {
    const ops: WriteOp[] = [
      ...(input.customers ?? []).map((value) => ({ type: 'put' as const, store: 'customers' as const, value })),
      ...(input.visits ?? []).map((value) => ({ type: 'put' as const, store: 'visits' as const, value })),
      ...(input.contacts ?? []).map((value) => ({ type: 'put' as const, store: 'contacts' as const, value })),
    ]
    return this.serial(() => this.write(ops))
  }

  /* ========== 連絡の記録 ========== */

  async contactsOfCustomer(customerId: ID): Promise<ContactLog[]> {
    const list = await this.backend.getAllByIndex<ContactLog>('contacts', 'customerId', customerId)
    return list.filter((c) => !c.deletedAt)
  }

  putContact(c: ContactLog): Promise<void> {
    return this.serial(() => this.write([{ type: 'put', store: 'contacts', value: c }]))
  }

  /* ========== メニュー・文面 ========== */

  putMenu(m: Menu): Promise<void> {
    return this.serial(() => this.write([{ type: 'put', store: 'menus', value: m }]))
  }

  putMenus(ms: readonly Menu[]): Promise<void> {
    return this.serial(() => this.write(ms.map((value) => ({ type: 'put' as const, store: 'menus' as const, value }))))
  }

  deleteMenu(id: ID): Promise<void> {
    return this.serial(() => this.write([{ type: 'delete', store: 'menus', key: id }]))
  }

  putTemplate(t: MessageTemplate): Promise<void> {
    return this.serial(() => this.write([{ type: 'put', store: 'templates', value: t }]))
  }

  putTemplates(ts: readonly MessageTemplate[]): Promise<void> {
    return this.serial(() => this.write(ts.map((value) => ({ type: 'put' as const, store: 'templates' as const, value }))))
  }

  /* ========== 設定・カウンタ ========== */

  async getSettings(): Promise<Settings | null> {
    return (await this.backend.get<Settings>('settings', SINGLE_KEYS.settings)) ?? null
  }

  putSettings(s: Settings): Promise<void> {
    return this.serial(() => this.write([{ type: 'put', store: 'settings', value: s, key: SINGLE_KEYS.settings }]))
  }

  /** 設定を消す（S0 の前の状態に戻す） */
  deleteSettings(): Promise<void> {
    return this.serial(() => this.write([{ type: 'delete', store: 'settings', key: SINGLE_KEYS.settings }]))
  }

  /** 設定の一部を書き換える（設定がまだなければ何もしない） */
  updateSettings(patch: (s: Settings) => Settings): Promise<Settings | null> {
    return this.serial(async () => {
      const cur = await this.getSettings()
      if (!cur) return null
      const next = patch(cur)
      await this.write([{ type: 'put', store: 'settings', value: next, key: SINGLE_KEYS.settings }])
      return next
    })
  }

  async getCounters(): Promise<LocalCounters | null> {
    return (await this.backend.get<LocalCounters>('counters', SINGLE_KEYS.counters)) ?? null
  }

  putCounters(c: LocalCounters): Promise<void> {
    return this.serial(() => this.write([{ type: 'put', store: 'counters', value: c, key: SINGLE_KEYS.counters }]))
  }

  /** 使い方の回数を増やす（カウンタがまだなければ firstUsedOn で作る） */
  incrementCounter(key: CounterKey, by = 1, firstUsedOn?: string): Promise<LocalCounters | null> {
    return this.serial(async () => {
      let cur = await this.getCounters()
      if (!cur) {
        if (!firstUsedOn) return null
        cur = { firstUsedOn, visitsSaved: 0, mataneSent: 0, koekakeSent: 0, koekakeSkipped: 0, actuallyVisitedFixes: 0 }
      }
      const next = { ...cur, [key]: cur[key] + by }
      await this.write([{ type: 'put', store: 'counters', value: next, key: SINGLE_KEYS.counters }])
      return next
    })
  }

  /* ========== 削除と取り消し（6.1） ========== */

  /**
   * 顧客を削除する（まず削除印だけ）。来店・連絡の記録にも同じ削除印を付ける。
   * 戻り値の時刻を restoreCustomer に渡すと取り消せる。
   */
  softDeleteCustomer(id: ID, at: ISODateTime = nowISO()): Promise<ISODateTime> {
    return this.serial(async () => {
      const c = await this.getCustomer(id)
      if (!c) return at
      // すでに削除印がある（二重に押した）ときは書き換えず、最初の削除印を返す
      if (c.deletedAt) return c.deletedAt
      const [visits, contacts] = await Promise.all([
        this.backend.getAllByIndex<Visit>('visits', 'customerId', id),
        this.backend.getAllByIndex<ContactLog>('contacts', 'customerId', id),
      ])
      const ops: WriteOp[] = [{ type: 'put', store: 'customers', value: { ...c, deletedAt: at } }]
      for (const v of visits) if (!v.deletedAt) ops.push({ type: 'put', store: 'visits', value: { ...v, deletedAt: at } })
      for (const k of contacts) if (!k.deletedAt) ops.push({ type: 'put', store: 'contacts', value: { ...k, deletedAt: at } })
      await this.write(ops)
      return at
    })
  }

  /** 顧客の削除の取り消し（同じ削除印の来店・連絡の記録も戻す） */
  restoreCustomer(id: ID, at: ISODateTime): Promise<void> {
    return this.serial(async () => {
      const c = await this.getCustomer(id)
      if (!c) return
      const [visits, contacts] = await Promise.all([
        this.backend.getAllByIndex<Visit>('visits', 'customerId', id),
        this.backend.getAllByIndex<ContactLog>('contacts', 'customerId', id),
      ])
      const ops: WriteOp[] = [{ type: 'put', store: 'customers', value: withoutDeletedAt(c) }]
      for (const v of visits) if (v.deletedAt === at) ops.push({ type: 'put', store: 'visits', value: withoutDeletedAt(v) })
      for (const k of contacts) if (k.deletedAt === at) ops.push({ type: 'put', store: 'contacts', value: withoutDeletedAt(k) })
      await this.write(ops)
    })
  }

  /** 顧客を完全に消す（来店・連絡の記録も） */
  purgeCustomer(id: ID): Promise<void> {
    return this.serial(() => this.purgeCustomerNow(id))
  }

  /**
   * 顧客を完全に消す。来店・連絡の記録に加え、その顧客を指す下書き（呼び名・文面・メモ）と、
   * 戻す前の状態（RestorePoint）の中のその顧客も消す（6.1・7.3。消したはずの人が端末に残らないように）
   */
  private async purgeCustomerNow(id: ID): Promise<void> {
    await this.purgeCustomersNow(new Set([id]))
  }

  private async purgeCustomersNow(ids: ReadonlySet<ID>, extraRestorePointFilter?: (c: Customer) => boolean): Promise<void> {
    if (ids.size === 0 && !extraRestorePointFilter) return
    const ops: WriteOp[] = []
    const goneVisits = new Set<ID>()
    for (const id of ids) {
      const [visits, contacts] = await Promise.all([
        this.backend.getAllByIndex<Visit>('visits', 'customerId', id),
        this.backend.getAllByIndex<ContactLog>('contacts', 'customerId', id),
      ])
      ops.push({ type: 'delete', store: 'customers', key: id })
      for (const v of visits) {
        ops.push({ type: 'delete', store: 'visits', key: v.id })
        goneVisits.add(v.id)
      }
      for (const k of contacts) ops.push({ type: 'delete', store: 'contacts', key: k.id })
    }
    ops.push(...(await this.scrubDraftOps((cid) => ids.has(cid), (vid) => goneVisits.has(vid))))
    const rp = await this.getRestorePoint()
    if (rp) {
      const next = stripRestorePoint(rp, (c) => ids.has(c.id) || !!extraRestorePointFilter?.(c))
      if (next) ops.push({ type: 'put', store: 'restorePoint', value: next, key: SINGLE_KEYS.restorePoint })
    }
    await this.write(ops)
  }

  /** 消えた顧客・来店記録を指す下書きを消す（または該当する行だけ取り除く）書き込み */
  private async scrubDraftOps(isGoneCustomer: (id: ID) => boolean, isGoneVisit: (id: ID) => boolean): Promise<WriteOp[]> {
    const drafts = await this.backend.getAll<Draft>('drafts')
    const ops: WriteOp[] = []
    for (const d of drafts) {
      const r = scrubDraft(d, isGoneCustomer, isGoneVisit)
      if (r.op === 'delete') ops.push({ type: 'delete', store: 'drafts', key: d.formId })
      else if (r.op === 'put') ops.push({ type: 'put', store: 'drafts', value: { ...d, data: r.data } })
    }
    return ops
  }

  softDeleteVisit(id: ID, at: ISODateTime = nowISO()): Promise<ISODateTime> {
    return this.serial(async () => {
      const v = await this.getVisit(id)
      if (v?.deletedAt) return v.deletedAt
      if (v) await this.write([{ type: 'put', store: 'visits', value: { ...v, deletedAt: at } }])
      return at
    })
  }

  restoreVisit(id: ID): Promise<void> {
    return this.serial(async () => {
      const v = await this.getVisit(id)
      if (v) await this.write([{ type: 'put', store: 'visits', value: withoutDeletedAt(v) }])
    })
  }

  purgeVisit(id: ID): Promise<void> {
    return this.serial(() => this.write([{ type: 'delete', store: 'visits', key: id }]))
  }

  /** まとめ記録の取り消しなど、複数の来店記録を完全に消す */
  purgeVisits(ids: readonly ID[]): Promise<void> {
    return this.serial(() => this.write(ids.map((key) => ({ type: 'delete' as const, store: 'visits' as const, key }))))
  }

  softDeleteContact(id: ID, at: ISODateTime = nowISO()): Promise<ISODateTime> {
    return this.serial(async () => {
      const c = await this.backend.get<ContactLog>('contacts', id)
      if (c) await this.write([{ type: 'put', store: 'contacts', value: { ...c, deletedAt: at } }])
      return at
    })
  }

  restoreContact(id: ID): Promise<void> {
    return this.serial(async () => {
      const c = await this.backend.get<ContactLog>('contacts', id)
      if (c) await this.write([{ type: 'put', store: 'contacts', value: withoutDeletedAt(c) }])
    })
  }

  purgeContact(id: ID): Promise<void> {
    return this.serial(() => this.write([{ type: 'delete', store: 'contacts', key: id }]))
  }

  /**
   * 起動時の掃除: 残っている削除印つきのデータを完全に消す。
   * あわせて、もういない顧客・来店記録を指す下書きと、開けなくなった前の日のまとめ記録の下書き（'batch:<日付>'）を消す。
   */
  purgeDeleted(today?: ISODate): Promise<PurgeResult> {
    return this.serial(async () => {
      const [customers, visits, contacts] = await Promise.all([
        this.backend.getAll<Customer>('customers'),
        this.backend.getAll<Visit>('visits'),
        this.backend.getAll<ContactLog>('contacts'),
      ])
      const deadCustomers = new Set(customers.filter((c) => c.deletedAt).map((c) => c.id))
      const liveCustomers = new Set(customers.filter((c) => !c.deletedAt).map((c) => c.id))
      const ops: WriteOp[] = []
      let nv = 0
      let nc = 0
      for (const id of deadCustomers) ops.push({ type: 'delete', store: 'customers', key: id })
      const liveVisits = new Set<ID>()
      for (const v of visits) {
        if (v.deletedAt || deadCustomers.has(v.customerId)) {
          ops.push({ type: 'delete', store: 'visits', key: v.id })
          nv++
        } else liveVisits.add(v.id)
      }
      for (const k of contacts) {
        if (k.deletedAt || deadCustomers.has(k.customerId)) {
          ops.push({ type: 'delete', store: 'contacts', key: k.id })
          nc++
        }
      }
      ops.push(...(await this.scrubDraftOps((id) => !liveCustomers.has(id), (id) => !liveVisits.has(id))))
      if (today) {
        const drafts = await this.backend.getAll<Draft>('drafts')
        for (const d of drafts) {
          const m = /^batch:(\d{4}-\d{2}-\d{2})$/.exec(d.formId)
          if (m && m[1] < today && !ops.some((o) => o.type === 'delete' && o.store === 'drafts' && o.key === d.formId)) {
            ops.push({ type: 'delete', store: 'drafts', key: d.formId })
          }
        }
      }
      if (deadCustomers.size > 0) {
        const rp = await this.getRestorePoint()
        const next = rp ? stripRestorePoint(rp, (c) => deadCustomers.has(c.id)) : null
        if (next) ops.push({ type: 'put', store: 'restorePoint', value: next, key: SINGLE_KEYS.restorePoint })
      }
      await this.write(ops)
      return { customers: deadCustomers.size, visits: nv, contacts: nc }
    })
  }

  /**
   * ［所属サロンの顧客をまとめて削除］: 該当する顧客と来店・連絡の記録を完全に消す。消した人数を返す。
   * 下書きと、戻す前の状態（RestorePoint）に残っている所属サロンの顧客も消す（［戻す前の状態に戻す］で戻らないように）
   */
  deleteSalonCustomers(): Promise<number> {
    return this.serial(async () => {
      const customers = await this.backend.getAll<Customer>('customers')
      const salon = customers.filter((c) => c.stewardship?.steward === 'salon')
      await this.purgeCustomersNow(new Set(salon.map((c) => c.id)), (c) => c.stewardship?.steward === 'salon')
      return salon.length
    })
  }

  /* ========== 下書き（6.1） ========== */

  getDraft(formId: string): Promise<Draft | undefined> {
    return this.backend.get<Draft>('drafts', formId)
  }

  putDraft(formId: string, data: unknown, updatedAt: ISODateTime = nowISO()): Promise<void> {
    const d: Draft = { formId, data, updatedAt }
    return this.serial(() => this.write([{ type: 'put', store: 'drafts', value: d }]))
  }

  deleteDraft(formId: string): Promise<void> {
    return this.serial(() => this.write([{ type: 'delete', store: 'drafts', key: formId }]))
  }

  listDrafts(): Promise<Draft[]> {
    return this.backend.getAll<Draft>('drafts')
  }

  /* ========== 戻す前の状態（7.4） ========== */

  async getRestorePoint(): Promise<RestorePoint | null> {
    return (await this.backend.get<RestorePoint>('restorePoint', SINGLE_KEYS.restorePoint)) ?? null
  }

  putRestorePoint(rp: RestorePoint): Promise<void> {
    return this.serial(() =>
      this.write([{ type: 'put', store: 'restorePoint', value: rp, key: SINGLE_KEYS.restorePoint }]),
    )
  }

  clearRestorePoint(): Promise<void> {
    return this.serial(() => this.write([{ type: 'delete', store: 'restorePoint', key: SINGLE_KEYS.restorePoint }]))
  }

  /* ========== まとめて ========== */

  /**
   * 記録を BackupPayload で置き換える（バックアップから戻す・サンプルを入れる）。
   * 下書きも消す。RestorePoint は残す。keepLock を渡すとその PIN を設定に残す。
   */
  replaceAll(payload: BackupPayload, options: { keepLock?: PinLock } = {}): Promise<void> {
    const settings: Settings = { ...(payload.settings as Settings) }
    delete settings.lock
    if (options.keepLock) settings.lock = options.keepLock
    const ops: WriteOp[] = [
      { type: 'clear', store: 'customers' },
      { type: 'clear', store: 'visits' },
      { type: 'clear', store: 'menus' },
      { type: 'clear', store: 'contacts' },
      { type: 'clear', store: 'templates' },
      { type: 'clear', store: 'settings' },
      { type: 'clear', store: 'counters' },
      { type: 'clear', store: 'drafts' },
      ...payload.customers.map((value) => ({ type: 'put' as const, store: 'customers' as const, value })),
      ...payload.visits.map((value) => ({ type: 'put' as const, store: 'visits' as const, value })),
      ...payload.menus.map((value) => ({ type: 'put' as const, store: 'menus' as const, value })),
      ...payload.contacts.map((value) => ({ type: 'put' as const, store: 'contacts' as const, value })),
      ...payload.templates.map((value) => ({ type: 'put' as const, store: 'templates' as const, value })),
      { type: 'put', store: 'settings', value: settings, key: SINGLE_KEYS.settings },
      { type: 'put', store: 'counters', value: payload.counters, key: SINGLE_KEYS.counters },
    ]
    return this.serial(() => this.write(ops))
  }

  /** すべてのストアを空にする */
  clearAll(): Promise<void> {
    const stores = ['customers', 'visits', 'menus', 'contacts', 'templates', 'settings', 'drafts', 'counters', 'restorePoint'] as const
    return this.serial(() => this.write(stores.map((store) => ({ type: 'clear' as const, store }))))
  }

  /** 書き込みが終わるのを待つ */
  flush(): Promise<void> {
    return this.queue.then(() => undefined)
  }

  close(): void {
    this.backend.close()
  }
}

function withoutDeletedAt<T extends { deletedAt?: string }>(x: T): T {
  const copy = { ...x }
  delete copy.deletedAt
  return copy
}

/**
 * 戻す前の状態（RestorePoint）から、条件に当たる顧客とその来店・連絡の記録を除く。
 * 何も変わらなければ null
 */
export function stripRestorePoint(rp: RestorePoint, drop: (c: Customer) => boolean): RestorePoint | null {
  const gone = new Set(rp.payload.customers.filter(drop).map((c) => c.id))
  if (gone.size === 0) return null
  return {
    ...rp,
    payload: {
      ...rp.payload,
      customers: rp.payload.customers.filter((c) => !gone.has(c.id)),
      visits: rp.payload.visits.filter((v) => !gone.has(v.customerId)),
      contacts: rp.payload.contacts.filter((k) => !gone.has(k.customerId)),
    },
  }
}

type ScrubResult = { op: 'keep' } | { op: 'delete' } | { op: 'put'; data: unknown }

/**
 * 下書きが消えた顧客・来店記録を指していれば、消すか、該当する行だけ取り除く。
 * - 'koekake:<顧客>'・'visit:new:<顧客>'・'visit:fix:<顧客>'・'visit:edit:<来店>' は丸ごと消す
 * - data.customerId がその顧客の下書き（客を選んだあとの 'visit:new'）も丸ごと消す
 * - 'bulk' はその顧客の行だけ、'batch:<日付>' はその顧客の行と足した人だけを取り除く
 */
export function scrubDraft(d: Draft, isGoneCustomer: (id: ID) => boolean, isGoneVisit: (id: ID) => boolean): ScrubResult {
  const m = /^(koekake|visit:new|visit:fix|visit:edit):(.+)$/.exec(d.formId)
  if (m) {
    if (m[1] === 'visit:edit' ? isGoneVisit(m[2]) : isGoneCustomer(m[2])) return { op: 'delete' }
  }
  const data = d.data
  if (!data || typeof data !== 'object') return { op: 'keep' }
  const x = data as Record<string, unknown>
  if (typeof x.customerId === 'string' && isGoneCustomer(x.customerId)) return { op: 'delete' }
  if (Array.isArray(x.rows)) {
    const rows = x.rows.filter((r) => !(r && typeof r === 'object' && typeof (r as { customerId?: unknown }).customerId === 'string' && isGoneCustomer((r as { customerId: string }).customerId)))
    return rows.length === x.rows.length ? { op: 'keep' } : { op: 'put', data: { ...x, rows } }
  }
  if (x.rows && typeof x.rows === 'object' && Array.isArray(x.added)) {
    const rows = { ...(x.rows as Record<string, unknown>) }
    let changed = false
    for (const id of Object.keys(rows)) {
      if (isGoneCustomer(id)) {
        delete rows[id]
        changed = true
      }
    }
    const added = (x.added as unknown[]).filter((id) => !(typeof id === 'string' && isGoneCustomer(id)))
    if (added.length !== x.added.length) changed = true
    return changed ? { op: 'put', data: { ...x, rows, added } } : { op: 'keep' }
  }
  return { op: 'keep' }
}

/* ========== 開く・消す ========== */

export interface OpenOptions {
  /** 開くデータベース（省略時は localStorage 'matane.activeDb'。使えなければ本番用） */
  dbName?: DbName
  /** テストで差し替える IDBFactory */
  factory?: IDBFactory | null
}

/** IndexedDB のデータベースを開く。使えなければ StorageUnavailableError */
export async function openRepository(options: OpenOptions = {}): Promise<Repository> {
  const dbName = options.dbName ?? getActiveDbName()
  const factory = options.factory === undefined ? defaultIdbFactory() : options.factory
  if (!factory) throw new StorageUnavailableError()
  try {
    const backend = await IdbBackend.open(dbName, factory)
    return new Repository(dbName, backend)
  } catch (e) {
    throw new StorageUnavailableError(e)
  }
}

/** メモリ保存（保存しない）の Repository */
export function createMemoryRepository(dbName: DbName = SAMPLE_DB): Repository {
  return new Repository(dbName, new MemoryBackend())
}

/**
 * IndexedDB を開き、使えなければメモリ保存に切り替える（4.1 エラー時）。
 * fallback が true のときは「この状態では記録を保存できません…」を出す。
 */
export async function openRepositoryOrMemory(options: OpenOptions = {}): Promise<{ repo: Repository; fallback: boolean }> {
  try {
    return { repo: await openRepository(options), fallback: false }
  } catch (e) {
    if (!(e instanceof StorageUnavailableError)) throw e
    return { repo: createMemoryRepository(options.dbName ?? getActiveDbName()), fallback: true }
  }
}

/** データベースを丸ごと消す（開いている Repository は先に close する） */
export async function deleteDatabase(dbName: DbName, factory: IDBFactory | null = defaultIdbFactory()): Promise<void> {
  if (!factory) return
  await deleteIdb(dbName, factory)
}

export { PROD_DB, SAMPLE_DB }
