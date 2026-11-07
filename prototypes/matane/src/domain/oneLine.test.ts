import { describe, expect, it } from 'vitest'
import { ONE_LINE_WARNINGS, parseOneLine, segmentMenus } from './oneLine'
import { MENUS, cust } from '../test/factories'

const V = '2026-11-07'
const customers = [
  cust('yuzu', { nickname: 'ゆず', kana: 'ゆず' }),
  cust('momiji', { nickname: 'もみじ', kana: 'もみじ' }),
  cust('tsubaki', { nickname: 'つばき', kana: 'つばき' }),
]
const parse = (s: string) => parseOneLine(s, V, customers, MENUS)
const ids = (r: ReturnType<typeof parse>) => r.customerMatches.map((c) => c.nickname)

describe('6.11 1行入力の解析（AC-08）', () => {
  it('ゆず カットカラー 6週 8800 → 客＝ゆず、メニュー＝カット・カラー、次回＝6週、金額＝8,800円', () => {
    const r = parse('ゆず カットカラー 6週 8800')
    expect(ids(r)).toEqual(['ゆず'])
    expect(r.menuIds).toEqual(['cut', 'color'])
    expect(r.next).toEqual({ kind: 'agreed', amount: 6, unit: 'week' })
    expect(r.price).toBe(8800)
    expect(r.unparsed).toEqual([])
  })

  it('ゆずさん カットとカラー 2ヶ月 → 客＝ゆず、メニュー＝カット・カラー、次回＝2か月', () => {
    const r = parse('ゆずさん カットとカラー 2ヶ月')
    expect(ids(r)).toEqual(['ゆず'])
    expect(r.menuIds).toEqual(['cut', 'color'])
    expect(r.next).toEqual({ kind: 'agreed', amount: 2, unit: 'month' })
    expect(r.unparsed).toEqual([])
  })

  it('もみじ 白髪染め 12/19 → 次回＝予約 2026-12-19', () => {
    const r = parse('もみじ 白髪染め 12/19')
    expect(ids(r)).toEqual(['もみじ'])
    expect(r.menuIds).toEqual(['gray'])
    expect(r.next).toEqual({ kind: 'booked', date: '2026-12-19' })
  })

  it('もみじ 白髪染め 1/9 → 次回＝予約 2027-01-09', () => {
    expect(parse('もみじ 白髪染め 1/9').next).toEqual({ kind: 'booked', date: '2027-01-09' })
  })

  it('もみじ 白髪染め 11/7 → 読み取れなかった語［11/7］（来店日と同じ）', () => {
    const r = parse('もみじ 白髪染め 11/7')
    expect(r.unparsed).toEqual(['11/7'])
    expect(r.next).toBeUndefined()
    expect(r.warnings).toContain(ONE_LINE_WARNINGS.bookedSameDay)
  })

  it('ゆず かっと からー → メニュー＝カット・カラー（ひらがなでも照合）', () => {
    const r = parse('ゆず かっと からー')
    expect(ids(r)).toEqual(['ゆず'])
    expect(r.menuIds).toEqual(['cut', 'color'])
  })

  it('ゆ カット → 客の候補＝［ゆず］（前方一致）', () => {
    const r = parse('ゆ カット')
    expect(ids(r)).toEqual(['ゆず'])
    expect(r.menuIds).toEqual(['cut'])
  })

  it('さくら カット → 客の候補なし（「新しいお客様として登録」を出す）', () => {
    const r = parse('さくら カット')
    expect(r.customerMatches).toEqual([])
    expect(r.nameToken).toBe('さくら')
    expect(r.menuIds).toEqual(['cut'])
  })

  it('ゆず カット 7 → 読み取れなかった語［7］', () => {
    const r = parse('ゆず カット 7')
    expect(r.unparsed).toEqual(['7'])
    expect(ids(r)).toEqual(['ゆず'])
  })

  it('次回の指定が複数あれば最後のものを使い、注意を出す', () => {
    const r = parse('ゆず カット 6週 2か月')
    expect(r.next).toEqual({ kind: 'agreed', amount: 2, unit: 'month' })
    expect(r.warnings).toContain('次回の指定が2つありました')
  })

  it('全角・区切り・敬称・金額の書き方', () => {
    const r = parse('ユズ様、カット＋カラー，おまかせ　８８００円')
    expect(ids(r)).toEqual(['ゆず'])
    expect(r.menuIds).toEqual(['cut', 'color'])
    expect(r.next).toEqual({ kind: 'omakase' })
    expect(r.price).toBe(8800)
    expect(parse('ゆず カット 8,800円').price).toBe(8800)
    expect(parse('ゆず カット 6w').next).toEqual({ kind: 'agreed', amount: 6, unit: 'week' })
    expect(parse('ゆず カット 3か月後').next).toEqual({ kind: 'agreed', amount: 3, unit: 'month' })
    expect(parse('ゆず カット 12月19日').next).toEqual({ kind: 'booked', date: '2026-12-19' })
  })

  it('範囲外の目安・存在しない日付は読み取れなかった語へ', () => {
    expect(parse('ゆず カット 30週').unparsed).toEqual(['30週'])
    expect(parse('ゆず カット 13か月').unparsed).toEqual(['13か月'])
    expect(parse('ゆず カット 2/30').unparsed).toEqual(['2/30'])
  })

  it('名前の語がなければ選択済みの客を使う', () => {
    const r = parseOneLine('カット 6週', V, customers, MENUS, customers[1])
    expect(ids(r)).toEqual(['もみじ'])
  })

  it('メニューの切り分け（最長一致・間の「と」）', () => {
    expect(segmentMenus('白髪染め', MENUS)).toEqual(['gray'])
    expect(segmentMenus('カットとトリートメント', MENUS)).toEqual(['cut', 'treatment'])
    expect(segmentMenus('カットと', MENUS)).toBeNull()
    expect(segmentMenus('ゆず', MENUS)).toBeNull()
  })
})
