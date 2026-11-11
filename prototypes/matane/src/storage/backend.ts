/**
 * 保存先の最小の口（IndexedDB とメモリの2つの実装）。
 * Repository はこの上に作るので、IndexedDB が使えないときはメモリ保存に切り替えられる（4.1 エラー時）。
 */
import { INDEXES, KEY_PATHS, STORES, openIdb, requestToPromise, transactionDone, type StoreName } from './idb'

export type WriteOp =
  | { type: 'put'; store: StoreName; value: unknown; key?: IDBValidKey }
  | { type: 'delete'; store: StoreName; key: IDBValidKey }
  | { type: 'clear'; store: StoreName }

export interface Backend {
  readonly kind: 'indexeddb' | 'memory'
  getAll<T>(store: StoreName): Promise<T[]>
  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined>
  getAllByIndex<T>(store: StoreName, index: string, value: IDBValidKey): Promise<T[]>
  /** まとめて書く（IndexedDB では1つのトランザクションで、全部成功か全部失敗） */
  write(ops: readonly WriteOp[]): Promise<void>
  close(): void
}

/* ========== IndexedDB ========== */

export class IdbBackend implements Backend {
  readonly kind = 'indexeddb' as const
  private readonly db: IDBDatabase

  private constructor(db: IDBDatabase) {
    this.db = db
  }

  static async open(name: string, factory: IDBFactory): Promise<IdbBackend> {
    return new IdbBackend(await openIdb(name, factory))
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    const tx = this.db.transaction(store, 'readonly')
    return (await requestToPromise(tx.objectStore(store).getAll())) as T[]
  }

  async get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    const tx = this.db.transaction(store, 'readonly')
    return (await requestToPromise(tx.objectStore(store).get(key))) as T | undefined
  }

  async getAllByIndex<T>(store: StoreName, index: string, value: IDBValidKey): Promise<T[]> {
    const tx = this.db.transaction(store, 'readonly')
    return (await requestToPromise(tx.objectStore(store).index(index).getAll(value))) as T[]
  }

  async write(ops: readonly WriteOp[]): Promise<void> {
    if (ops.length === 0) return
    const names = [...new Set(ops.map((o) => o.store))]
    const tx = this.db.transaction(names, 'readwrite')
    const done = transactionDone(tx)
    try {
      for (const op of ops) {
        const store = tx.objectStore(op.store)
        if (op.type === 'put') {
          if (KEY_PATHS[op.store]) store.put(op.value)
          else store.put(op.value, op.key)
        } else if (op.type === 'delete') store.delete(op.key)
        else store.clear()
      }
    } catch (e) {
      try {
        tx.abort()
      } catch {
        // すでに終わっている
      }
      await done.catch(() => undefined)
      throw e
    }
    await done
  }

  close(): void {
    this.db.close()
  }
}

/* ========== メモリ ========== */

function clone<T>(v: T): T {
  if (v === undefined) return v
  if (typeof structuredClone === 'function') return structuredClone(v)
  return JSON.parse(JSON.stringify(v)) as T
}

function keyOf(store: StoreName, value: unknown, key?: IDBValidKey): string {
  const kp = KEY_PATHS[store]
  if (kp) {
    const k = (value as Record<string, unknown>)[kp]
    if (typeof k !== 'string' && typeof k !== 'number') throw new Error(`キーがありません: ${store}.${kp}`)
    return String(k)
  }
  if (key === undefined) throw new Error(`キーがありません: ${store}`)
  return String(key)
}

/** 保存しないメモリ上の実装（IndexedDB が使えないときのサンプル表示、テスト用） */
export class MemoryBackend implements Backend {
  readonly kind = 'memory' as const
  private readonly data = new Map<StoreName, Map<string, unknown>>()

  constructor() {
    for (const s of STORES) this.data.set(s, new Map())
  }

  private table(store: StoreName): Map<string, unknown> {
    return this.data.get(store)!
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    const t = this.table(store)
    return [...t.keys()].sort().map((k) => clone(t.get(k)) as T)
  }

  async get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return clone(this.table(store).get(String(key))) as T | undefined
  }

  async getAllByIndex<T>(store: StoreName, index: string, value: IDBValidKey): Promise<T[]> {
    if (!INDEXES[store]?.includes(index)) throw new Error(`索引がありません: ${store}.${index}`)
    const all = await this.getAll<Record<string, unknown>>(store)
    return all.filter((r) => r[index] === value) as T[]
  }

  async write(ops: readonly WriteOp[]): Promise<void> {
    // 全部のキーを先に確かめてから書く（途中で失敗して半端に書かないように）
    const prepared = ops.map((op) => (op.type === 'put' ? { op, k: keyOf(op.store, op.value, op.key) } : { op, k: '' }))
    for (const { op, k } of prepared) {
      const t = this.table(op.store)
      if (op.type === 'put') t.set(k, clone(op.value))
      else if (op.type === 'delete') t.delete(String(op.key))
      else t.clear()
    }
  }

  close(): void {
    // 何もしない
  }
}
