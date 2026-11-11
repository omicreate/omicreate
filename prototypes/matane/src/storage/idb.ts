/**
 * IndexedDB の薄い Promise ラッパー（依存を足さない）。仕様 5.2 のストアと索引を作る。
 */

export const DB_VERSION = 1

export const STORES = [
  'customers',
  'visits',
  'menus',
  'contacts',
  'templates',
  'settings',
  'drafts',
  'counters',
  'restorePoint',
] as const
export type StoreName = (typeof STORES)[number]

/** keyPath（null は1件だけの値を固定のキーで置くストア） */
export const KEY_PATHS: Record<StoreName, string | null> = {
  customers: 'id',
  visits: 'id',
  menus: 'id',
  contacts: 'id',
  templates: 'kind',
  settings: null,
  drafts: 'formId',
  counters: null,
  restorePoint: null,
}

/** 索引（5.2: visits と contacts に customerId・date） */
export const INDEXES: Partial<Record<StoreName, readonly string[]>> = {
  visits: ['customerId', 'date'],
  contacts: ['customerId', 'date'],
}

/** 1件だけの値のキー */
export const SINGLE_KEYS = {
  settings: 'settings',
  counters: 'counters',
  restorePoint: 'restorePoint',
} as const

export function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB の要求に失敗しました'))
  })
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB のトランザクションが中断されました'))
    tx.onerror = () => {
      // onabort が続けて呼ばれる。ここでは何もしない
    }
  })
}

function upgrade(db: IDBDatabase): void {
  for (const name of STORES) {
    if (db.objectStoreNames.contains(name)) continue
    const keyPath = KEY_PATHS[name]
    const store = keyPath ? db.createObjectStore(name, { keyPath }) : db.createObjectStore(name)
    for (const idx of INDEXES[name] ?? []) store.createIndex(idx, idx, { unique: false })
  }
}

/** 使える IDBFactory（なければ null） */
export function defaultIdbFactory(): IDBFactory | null {
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB
  } catch {
    return null
  }
}

/** データベースを開く（なければ作る） */
export function openIdb(name: string, factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest
    try {
      req = factory.open(name, DB_VERSION)
    } catch (e) {
      reject(e)
      return
    }
    req.onupgradeneeded = () => upgrade(req.result)
    req.onsuccess = () => {
      const db = req.result
      // 別の画面がデータベースを消すときに邪魔をしない
      db.onversionchange = () => db.close()
      resolve(db)
    }
    req.onerror = () => reject(req.error ?? new Error('IndexedDB を開けませんでした'))
    req.onblocked = () => {
      // 古い接続が閉じるのを待つ
    }
  })
}

/** データベースを丸ごと消す */
export function deleteIdb(name: string, factory: IDBFactory): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let req: IDBOpenDBRequest
    try {
      req = factory.deleteDatabase(name)
    } catch (e) {
      reject(e)
      return
    }
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('データベースを消せませんでした'))
    req.onblocked = () => {
      // 開いている接続が onversionchange で閉じるのを待つ
    }
  })
}
