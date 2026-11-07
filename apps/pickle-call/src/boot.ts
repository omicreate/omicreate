// 起動時に URL の ?lang= と ?src= を取り込み、URL から消す（共有されたURLに印が残らないように）。
import { isValidSrc } from './infra/counter'
import { load, save } from './infra/storage'
import type { Lang } from './domain/types'

export function absorbQuery(): void {
  try {
    const url = new URL(location.href)
    const lang = url.searchParams.get('lang')
    const src = url.searchParams.get('src')
    let changed = false
    if (lang === 'ja' || lang === 'en') {
      const cur = load<Record<string, unknown> | null>('settings', null, (x): x is Record<string, unknown> | null => typeof x === 'object')
      save('settings', { ...(cur ?? {}), lang: lang as Lang, ...(cur ? {} : { voice: true, rate: 1 }) })
      url.searchParams.delete('lang')
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
      url.searchParams.delete('src')
      changed = true
    }
    if (changed) history.replaceState(history.state, '', url.pathname + (url.search ? url.search : '') + url.hash)
  } catch {
    // URL を直せなくてもアプリは動かす
  }
}
