/**
 * 依存を足さないハッシュのルーティング。
 * 例: '#/customer/abc'、'#/visit?c=abc&same=1'。
 */
import { useMemo, useSyncExternalStore } from 'react'

export interface Route {
  /** 例: ['customer', 'abc']（ホームは []） */
  path: string[]
  params: URLSearchParams
  /** 正規化したハッシュ（例 '#/customer/abc?x=1'） */
  hash: string
}

const listeners = new Set<() => void>()

function emit(): void {
  for (const l of [...listeners]) l()
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', emit)
  window.addEventListener('popstate', emit)
}

function currentHash(): string {
  if (typeof location === 'undefined') return '#/'
  return normalizeHash(location.hash)
}

/** 空のハッシュや '#' を '#/' にそろえる */
export function normalizeHash(hash: string): string {
  if (!hash || hash === '#') return '#/'
  return hash.startsWith('#/') ? hash : `#/${hash.replace(/^#/, '')}`
}

export function parseRoute(hash: string): Route {
  const h = normalizeHash(hash)
  const raw = h.slice(2)
  const q = raw.indexOf('?')
  const pathPart = q >= 0 ? raw.slice(0, q) : raw
  const query = q >= 0 ? raw.slice(q + 1) : ''
  const path = pathPart
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p)
      } catch {
        return p
      }
    })
  return { path, params: new URLSearchParams(query), hash: h }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** 今のルート（ハッシュが変わると描き直す） */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, currentHash, () => '#/')
  return useMemo(() => parseRoute(hash), [hash])
}

/** ルートが変わったときに呼ぶ（取り消しの確定などに使う） */
export function subscribeRoute(cb: () => void): () => void {
  return subscribe(cb)
}

export function currentRouteHash(): string {
  return currentHash()
}

/** ハッシュを作る。値が空・false の引数は付けない */
export function to(path: string, params: Record<string, string | number | boolean | null | undefined> = {}): string {
  const base = normalizeHash(path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`)
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === false || v === '') continue
    sp.set(k, v === true ? '1' : String(v))
  }
  const qs = sp.toString()
  return qs ? `${base}?${qs}` : base
}

/** 移動する。replace なら履歴を増やさない */
export function navigate(target: string, options: { replace?: boolean } = {}): void {
  const hash = normalizeHash(target.startsWith('#') ? target : `#${target}`)
  if (options.replace) {
    try {
      history.replaceState(history.state, '', hash)
    } catch {
      location.replace(hash)
      return
    }
    emit()
    return
  }
  if (normalizeHash(location.hash) === hash) {
    emit()
    return
  }
  location.hash = hash
}
