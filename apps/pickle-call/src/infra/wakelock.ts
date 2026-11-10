// 試合中に画面が消えないようにする（Screen Wake Lock API）。
// 対応していない端末では何もしない。画面が隠れると解放されるので、戻ったときに取り直す。
// 要求の途中でもう一度呼ばれても二重に要求しない。要求の途中で解放されたら、取れた時点ですぐ手放す。

type Sentinel = { release(): Promise<void>; released?: boolean }
type WakeLockNav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }

let sentinel: Sentinel | null = null
let pending: Promise<void> | null = null
let wanted = false
let listening = false

function onVisible() {
  if (wanted && document.visibilityState === 'visible' && (!sentinel || sentinel.released)) request()
}

function letGo(s: Sentinel | null) {
  try {
    void s?.release().catch(() => {})
  } catch {
    // 解放に失敗しても困らない
  }
}

function request(): void {
  if (pending) return
  const nav = navigator as WakeLockNav
  if (!nav.wakeLock?.request) return
  let p: Promise<Sentinel>
  try {
    p = nav.wakeLock.request('screen')
  } catch {
    return
  }
  pending = p
    .then((s) => {
      if (wanted) {
        sentinel = s
      } else {
        // 取れる前に「もう要らない」となっていた
        letGo(s)
      }
    })
    .catch(() => {
      sentinel = null
    })
    .finally(() => {
      pending = null
    })
}

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as WakeLockNav).wakeLock?.request
}

export function acquireWakeLock(): void {
  wanted = true
  if (!listening && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisible)
    listening = true
  }
  if (!sentinel || sentinel.released) request()
}

export function releaseWakeLock(): void {
  wanted = false
  const s = sentinel
  sentinel = null
  letGo(s)
}
