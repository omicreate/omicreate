// ハッシュで画面を切り替える（GitHub Pages でもリロードで404にならない）。例: #/learn?scene=rally-win
import { useEffect, useState } from 'react'

export type RouteName = 'home' | 'setup' | 'play' | 'result' | 'learn' | 'guide' | 'history' | 'settings'
const NAMES: RouteName[] = ['home', 'setup', 'play', 'result', 'learn', 'guide', 'history', 'settings']

export interface Route {
  name: RouteName
  query: URLSearchParams
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  const [path, qs = ''] = h.split('?')
  const first = path.split('/').filter(Boolean)[0] ?? ''
  const name = (NAMES as string[]).includes(first) ? (first as RouteName) : 'home'
  return { name, query: new URLSearchParams(qs) }
}

export const href = (name: RouteName, query?: Record<string, string>) => {
  const q = query ? `?${new URLSearchParams(query).toString()}` : ''
  return name === 'home' ? `#/${q}` : `#/${name}${q}`
}

/**
 * 画面を移る。replace: true なら履歴を積まずに、いまの画面と置きかえる
 * （使い終わった画面に「戻る」で戻らないように。例: 結果 → 次のゲーム、設定 → 開始）
 */
export function navigate(name: RouteName, query?: Record<string, string>, opts?: { replace?: boolean }) {
  const next = href(name, query)
  if (location.hash === next) return
  if (opts?.replace) location.replace(next)
  else location.hash = next
}

/** ハッシュが変わった（画面を移った）ときだけ立てる。最初の読み込みでは立てない */
let moved = false

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const onChange = () => {
      moved = true
      setRoute(parseHash(location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  // 画面を移ったら、新しい画面の見出しへフォーカスを移す（スクリーンリーダーに画面が変わったことを伝える。
  // 押したボタンが前の画面ごと消え、フォーカスが <body> に落ちたままにならないように）
  useEffect(() => {
    if (!moved) return
    moved = false
    const h = document.querySelector<HTMLElement>('main h1')
    if (!h) return
    h.tabIndex = -1
    h.focus({ preventScroll: true })
  }, [route])
  return route
}
