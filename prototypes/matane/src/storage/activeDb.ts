/** どちらのデータベースを開くか（仕様 5.2）。localStorage が使えないときは本番用 */

export const PROD_DB = 'matane'
export const SAMPLE_DB = 'matane-sample'
export type DbName = typeof PROD_DB | typeof SAMPLE_DB

/** localStorage のキー */
export const ACTIVE_DB_KEY = 'matane.activeDb'

export function isDbName(x: unknown): x is DbName {
  return x === PROD_DB || x === SAMPLE_DB
}

export function isSampleDb(name: DbName): boolean {
  return name === SAMPLE_DB
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** 開くデータベースの名前。読めない・値が違うときは本番用 */
export function getActiveDbName(storage: Storage | null = defaultStorage()): DbName {
  if (!storage) return PROD_DB
  try {
    const v = storage.getItem(ACTIVE_DB_KEY)
    return isDbName(v) ? v : PROD_DB
  } catch {
    return PROD_DB
  }
}

/** 開くデータベースを切り替える。保存できなければ false */
export function setActiveDbName(name: DbName, storage: Storage | null = defaultStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(ACTIVE_DB_KEY, name)
    return true
  } catch {
    return false
  }
}
