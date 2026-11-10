// 起動時に URL の ?lang= と ?src= を取り込み、URL から消す（共有されたURLに印が残らないように）。
// 「?」はハッシュの前（/pickle-call/?lang=en#/learn）でも、ハッシュの中（#/learn?scene=x&lang=en）でも受け付ける。
import { isValidSrc } from './infra/counter'
import { load, save } from './infra/storage'
import type { Lang } from './domain/types'

/** lang と src を取り込み、見つけたら params から消す。消したら true */
function absorb(params: URLSearchParams): boolean {
  const lang = params.get('lang')
  const src = params.get('src')
  let changed = false
  if (lang === 'ja' || lang === 'en') {
    const cur = load<Record<string, unknown> | null>('settings', null, (x): x is Record<string, unknown> | null => typeof x === 'object')
    save('settings', { ...(cur ?? {}), lang: lang as Lang, ...(cur ? {} : { voice: true, rate: 1 }) })
    params.delete('lang')
    changed = true
  } else if (lang !== null) {
    params.delete('lang')
    changed = true
  }
  if (src !== null) {
    if (isValidSrc(src)) {
      try {
        sessionStorage.setItem('pickle-call:src', src)
      } catch {
        // 保存できなくてもよい
      }
    }
    params.delete('src')
    changed = true
  }
  return changed
}

export function absorbQuery(): void {
  try {
    const url = new URL(location.href)
    let changed = absorb(url.searchParams)

    // ハッシュの中のクエリ（#/learn?scene=x&lang=en）
    const hash = url.hash
    const q = hash.indexOf('?')
    let nextHash = hash
    if (q >= 0) {
      const inner = new URLSearchParams(hash.slice(q + 1))
      if (absorb(inner)) {
        const rest = inner.toString()
        nextHash = hash.slice(0, q) + (rest ? `?${rest}` : '')
        changed = true
      }
    }
    if (changed) history.replaceState(history.state, '', url.pathname + (url.search ? url.search : '') + nextHash)
  } catch {
    // URL を直せなくてもアプリは動かす
  }
}
