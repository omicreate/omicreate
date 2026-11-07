// 言葉の辞書をまとめ、t(key, vars) で引く。{name} の形の差し込みに対応する。
import type { Lang } from '../domain/types'
import common from './common'
import learn from './learn'
import play from './play'
import screens from './screens'

const ja = { ...common.ja, ...play.ja, ...screens.ja, ...learn.ja }
const en = { ...common.en, ...play.en, ...screens.en, ...learn.en }

export type TKey = keyof typeof ja
export type TVars = Record<string, string | number>
export type T = (key: TKey, vars?: TVars) => string

export const dicts: Record<Lang, Record<TKey, string>> = { ja, en }

export function translate(lang: Lang, key: TKey, vars?: TVars): string {
  const raw = dicts[lang][key] ?? dicts.ja[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

export const makeT = (lang: Lang): T => (key, vars) => translate(lang, key, vars)
