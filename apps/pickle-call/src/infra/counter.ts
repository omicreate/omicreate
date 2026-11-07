// 匿名の回数だけを数える（名前・スコア・端末ID・Cookie は送らない）。
// 送り先はビルド時の VITE_COUNTER_URL。空なら何もしない。公開URL以外・「送らない」・DNT/GPC のときも送らない。

export type CounterStatus = 'off-config' | 'off-site' | 'off-user' | 'off-dnt' | 'on'
export type CounterEvent = 'open' | 'start' | 'finish' | 'share'

export const APP_ID = 'pickle-call'
export const APP_VERSION = '1.0.0'
export const PUBLIC_URL: string = (import.meta.env?.VITE_PUBLIC_URL as string | undefined) || 'https://omicreate.github.io/pickle-call/'
const COUNTER_URL: string = (import.meta.env?.VITE_COUNTER_URL as string | undefined) || ''

export interface CounterEnv {
  counterUrl: string
  publicUrl: string
  hostname: string
  userOn: boolean
  doNotTrack: string | null | undefined
  gpc: boolean | undefined
}

/** 判定の順: off-config → off-site → off-user → off-dnt → on */
export function counterStatus(env: CounterEnv): CounterStatus {
  if (!env.counterUrl || !/^https:\/\//.test(env.counterUrl)) return 'off-config'
  let publicHost = ''
  try {
    publicHost = new URL(env.publicUrl).hostname
  } catch {
    publicHost = ''
  }
  if (!publicHost || env.hostname !== publicHost) return 'off-site'
  if (!env.userOn) return 'off-user'
  if (env.doNotTrack === '1' || env.gpc === true) return 'off-dnt'
  return 'on'
}

export const isValidSrc = (s: string | null | undefined): s is string => !!s && /^[A-Za-z0-9_-]{1,40}$/.test(s)
const isValidGame = (s: string | undefined): s is string => !!s && /^[a-z0-9-]{1,20}$/.test(s)

export function counterUrl(base: string, p: { ev: CounterEvent; game?: string; src?: string | null; pwa?: boolean }): string {
  const q = new URLSearchParams({ app: APP_ID, ev: p.ev, v: APP_VERSION })
  if (isValidGame(p.game)) q.set('game', p.game)
  if (isValidSrc(p.src)) q.set('src', p.src)
  if (p.pwa !== undefined) q.set('pwa', p.pwa ? '1' : '0')
  // 送信先の URL がすでに ? を含む（クエリつき）ときは & でつなぐ
  return `${base}${base.includes('?') ? '&' : '?'}${q.toString()}`
}

export function browserEnv(userOn: boolean): CounterEnv {
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as Navigator & { globalPrivacyControl?: boolean }
  return {
    counterUrl: COUNTER_URL,
    publicUrl: PUBLIC_URL,
    hostname: typeof location !== 'undefined' ? location.hostname : '',
    userOn,
    doNotTrack: nav.doNotTrack,
    gpc: nav.globalPrivacyControl,
  }
}

function srcOf(): string | null {
  try {
    return sessionStorage.getItem('pickle-call:src')
  } catch {
    return null
  }
}

export function isStandalone(): boolean {
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

let openSent = false

export function track(userOn: boolean, ev: CounterEvent, game?: string): void {
  try {
    const env = browserEnv(userOn)
    if (counterStatus(env) !== 'on') return
    if (ev === 'open') {
      if (openSent) return
      openSent = true
    }
    const url = counterUrl(env.counterUrl, { ev, game, src: srcOf(), pwa: ev === 'open' ? isStandalone() : undefined })
    if (navigator.sendBeacon?.(url)) return
    void fetch(url, { mode: 'no-cors', credentials: 'omit', keepalive: true, referrerPolicy: 'no-referrer' }).catch(() => {})
  } catch {
    // 計測が失敗してもアプリ本体は止めない
  }
}
