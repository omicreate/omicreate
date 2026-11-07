/** ブラウザの機能（コピー・ファイルの書き出し・ホーム画面から開いているか）。外への通信はしない */

/** ホーム画面から開いているか（display-mode: standalone） */
export function isStandalone(): boolean {
  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) return true
    return (navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

/** クリップボードへコピーする。使えなければ false（画面で全選択して長押しを促す） */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** オフラインか（LINE を開けないとき） */
export function isOffline(): boolean {
  try {
    return typeof navigator !== 'undefined' && navigator.onLine === false
  } catch {
    return false
  }
}

/** 文字列をファイルとして書き出す（端末に保存。通信はしない） */
export function downloadText(fileName: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** 動きを減らす設定か */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
