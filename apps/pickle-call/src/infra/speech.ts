// 端末の読み上げ（Web Speech API の speechSynthesis）。
// iOS では、ユーザーの操作の中で同期的に speak を呼ばないと声が出ないため、speak は必ずクリックの処理から呼ぶ。
import type { Lang } from '../domain/types'

export interface Speaker {
  /** この端末で読み上げが使えるか */
  supported(): boolean
  speak(text: string, lang: Lang, rate: number): void
  cancel(): void
}

const LANG_TAG: Record<Lang, string> = { ja: 'ja-JP', en: 'en-US' }

export function createSpeaker(): Speaker {
  const synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.speechSynthesis?.speak === 'function'
      ? window.speechSynthesis
      : null
  let voices: SpeechSynthesisVoice[] = []
  const refresh = () => {
    try {
      voices = synth?.getVoices() ?? []
    } catch {
      voices = []
    }
  }
  refresh()
  try {
    synth?.addEventListener?.('voiceschanged', refresh)
  } catch {
    // 古いブラウザは無視
  }

  const pick = (lang: Lang) => {
    if (!voices.length) refresh()
    const tag = LANG_TAG[lang].toLowerCase()
    const short = lang
    return (
      voices.find((v) => v.lang?.toLowerCase() === tag && v.localService) ??
      voices.find((v) => v.lang?.toLowerCase() === tag) ??
      voices.find((v) => v.lang?.toLowerCase().startsWith(short)) ??
      null
    )
  }

  return {
    supported: () => synth !== null && typeof SpeechSynthesisUtterance !== 'undefined',
    speak(text, lang, rate) {
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined' || !text) return
      try {
        synth.cancel()
        const u = new SpeechSynthesisUtterance(text)
        u.lang = LANG_TAG[lang]
        u.rate = Math.min(1.5, Math.max(0.5, rate))
        const v = pick(lang)
        if (v) u.voice = v
        synth.speak(u)
      } catch {
        // 読み上げに失敗しても得点係は続けられる
      }
    },
    cancel() {
      try {
        synth?.cancel()
      } catch {
        // 同上
      }
    },
  }
}
