// 結果の共有。Web Share が使えればそれで、だめならクリップボードにコピーする。
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

export async function shareResult(text: string, url: string, file?: File): Promise<ShareResult> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  try {
    if (nav.share) {
      const data: ShareData = { text, url }
      if (file && nav.canShare?.({ files: [file] })) data.files = [file]
      await nav.share(data)
      return 'shared'
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
