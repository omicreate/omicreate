/** メモの健康語の注意（仕様 6.13）。当たっても保存は止めず、注意を出すだけ */
import { matchKey } from './text'

/** 語の一覧（初期）。「薬」「がん」単独は日常語に反応するため入れない */
export const HEALTH_WORDS: readonly string[] = [
  'アレルギー',
  'かぶれ',
  '湿疹',
  '皮膚炎',
  'アトピー',
  '妊娠',
  '妊婦',
  '授乳',
  '持病',
  '病気',
  '病院',
  '通院',
  '服薬',
  '飲み薬',
  '手術',
  '治療',
  '診断',
  '喘息',
  '既往',
  '生理',
  '体調',
]

export const HEALTH_WARNING = '健康に関することは書かないでください（要配慮個人情報にあたる場合があります）'

/** 当たった語（一覧の表記で、重複なし）。なければ空配列 */
export function detectHealthWords(text: string | undefined | null, words: readonly string[] = HEALTH_WORDS): string[] {
  if (!text) return []
  const key = matchKey(text)
  return words.filter((w) => key.includes(matchKey(w)))
}

export function hasHealthWords(text: string | undefined | null): boolean {
  return detectHealthWords(text).length > 0
}
