// 端末の中（localStorage）への保存。キーにはすべて「pickle-call:」を付ける
// （GitHub Pages のプロジェクトサイトは omicreate.github.io のオリジンを姉妹アプリと共有するため）。
// 値は {v:1, data} の形で包み、壊れていたら既定値に戻す。容量超過やプライベートブラウズでも落とさない。

export const PREFIX = 'pickle-call:'
const VERSION = 1

export type StoreKey = 'settings' | 'lastSetup' | 'current' | 'history' | 'learn'

function ls(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function load<T>(key: StoreKey, fallback: T, validate: (x: unknown) => x is T): T {
  try {
    const raw = ls()?.getItem(PREFIX + key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as { v?: unknown; data?: unknown }
    if (!parsed || parsed.v !== VERSION) return fallback
    return validate(parsed.data) ? parsed.data : fallback
  } catch {
    return fallback
  }
}

export function save(key: StoreKey, data: unknown): boolean {
  try {
    const s = ls()
    if (!s) return false
    if (data === null || data === undefined) s.removeItem(PREFIX + key)
    else s.setItem(PREFIX + key, JSON.stringify({ v: VERSION, data }))
    return true
  } catch {
    return false
  }
}

/** 「pickle-call:」で始まるキーだけを消す（同じオリジンの姉妹アプリの記録には触れない） */
export function clearAll(): void {
  try {
    const s = ls()
    if (!s) return
    const keys: string[] = []
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i)
      if (k && k.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach((k) => s.removeItem(k))
  } catch {
    // 消せなくてもアプリは止めない
  }
  try {
    sessionStorage.removeItem(PREFIX + 'src')
  } catch {
    // 同上
  }
}

export const HISTORY_MAX = 100

/** 履歴に入れる（同じ id は置き換え）。新しい順で最大100件 */
export function upsertRecord<T extends { id: string }>(list: readonly T[], rec: T): T[] {
  return [rec, ...list.filter((r) => r.id !== rec.id)].slice(0, HISTORY_MAX)
}

export const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
