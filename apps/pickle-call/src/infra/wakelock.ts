// 試合中に画面が消えないようにする（Screen Wake Lock API）。
// 対応していない端末では何もしない。画面が隠れると解放されるので、戻ったときに取り直す。

type Sentinel = { release(): Promise<void>; released?: boolean }
type WakeLockNav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }

let sentinel: Sentinel | null = null
let wanted = false
let listening = false

function onVisible() {
  if (wanted && document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void request()
}

async function request() {
  try {
    const nav = navigator as WakeLockNav
    if (!nav.wakeLock?.request) return
    sentinel = await nav.wakeLock.request('screen')
  } catch {
    sentinel = null
  }
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
  if (!sentinel || sentinel.released) void request()
}

export function releaseWakeLock(): void {
  wanted = false
  const s = sentinel
  sentinel = null
  try {
    void s?.release().catch(() => {})
  } catch {
    // 同上
  }
}
