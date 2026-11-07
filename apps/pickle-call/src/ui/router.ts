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

export function navigate(name: RouteName, query?: Record<string, string>) {
  const next = href(name, query)
  if (location.hash === next) return
  location.hash = next
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
