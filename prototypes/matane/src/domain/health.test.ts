import { describe, expect, it } from 'vitest'
import { detectHealthWords, hasHealthWords, HEALTH_WORDS } from './health'

describe('6.13 メモの健康語の注意（detectHealthWords）', () => {
  it('頭皮にアレルギーあり → 注意を出す', () => {
    expect(detectHealthWords('頭皮にアレルギーあり')).toEqual(['アレルギー'])
    expect(hasHealthWords('頭皮にアレルギーあり')).toBe(true)
  })

  it('根元 6% 30分、薬剤は前回と同じ → 注意なし', () => {
    expect(detectHealthWords('根元 6% 30分、薬剤は前回と同じ')).toEqual([])
  })

  it('受験がんばってた → 注意なし', () => {
    expect(detectHealthWords('受験がんばってた')).toEqual([])
  })

  it('一覧の語はすべて反応し、カタカナ・ひらがなの違いや全角半角も吸収する', () => {
    for (const w of HEALTH_WORDS) expect(detectHealthWords(`メモ ${w} あり`)).toContain(w)
    expect(detectHealthWords('あれるぎー')).toEqual(['アレルギー'])
    expect(detectHealthWords('ｱﾄﾋﾟｰ')).toEqual(['アトピー'])
    expect(detectHealthWords('カブレやすい')).toEqual(['かぶれ'])
  })

  it('空のメモ', () => {
    expect(detectHealthWords('')).toEqual([])
    expect(detectHealthWords(undefined)).toEqual([])
  })
})
