/** 永続保存（navigator.storage.persist）の要求と状態（4.1・4.9・7.4） */

export type PersistState = 'granted' | 'not_granted' | 'unsupported'

function storageManager(): StorageManager | null {
  try {
    return typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function'
      ? navigator.storage
      : null
  } catch {
    return null
  }
}

/** 永続保存を求める（本番で始めた時点・［もう一度求める］） */
export async function requestPersistentStorage(): Promise<PersistState> {
  const sm = storageManager()
  if (!sm) return 'unsupported'
  try {
    return (await sm.persist()) ? 'granted' : 'not_granted'
  } catch {
    return 'not_granted'
  }
}

/** 永続保存の状態 */
export async function persistentStorageState(): Promise<PersistState> {
  const sm = storageManager()
  if (!sm || typeof sm.persisted !== 'function') return 'unsupported'
  try {
    return (await sm.persisted()) ? 'granted' : 'not_granted'
  } catch {
    return 'not_granted'
  }
}
