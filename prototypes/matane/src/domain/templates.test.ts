import { describe, expect, it } from 'vitest'
import {
  bookedPhrase,
  duePhrase,
  joinMenuNames,
  lineShareUrl,
  nextPhrase,
  renderMatane,
  renderTemplate,
  spanForCustomer,
  spanForStylist,
  splitUnknownPlaceholders,
} from './templates'
import { DEFAULT_KOEKAKE_TEMPLATE, DEFAULT_MATANE_TEMPLATE } from './defaults'
import { MENUS, cust, settings } from '../test/factories'

describe('6.10 文面の差し込み', () => {
  it.each([
    ['2026-12-10', '12月上旬ごろ'],
    ['2026-12-19', '12月中旬ごろ'],
    ['2026-12-20', '12月中旬ごろ'],
    ['2026-12-21', '12月下旬ごろ'],
    ['2026-12-01', '12月上旬ごろ'],
    ['2026-12-11', '12月中旬ごろ'],
    ['2026-12-31', '12月下旬ごろ'],
  ])('duePhrase(%s) = %s', (d, expected) => {
    expect(duePhrase(d)).toBe(expected)
  })

  it('bookedPhrase(2026-12-19) = 12月19日（土）', () => {
    expect(bookedPhrase('2026-12-19')).toBe('12月19日（土）')
  })

  it.each([
    [42, '6週間'],
    [48, '7週間'],
    [49, '1か月半'],
    [60, '2か月'],
    [77, '2か月半'],
  ])('spanForCustomer(%i) = %s', (days, expected) => {
    expect(spanForCustomer(days)).toBe(expected)
  })

  it('spanForStylist(56) / (77) = 8週 / 11週', () => {
    expect(spanForStylist(56)).toBe('8週')
    expect(spanForStylist(77)).toBe('11週')
  })

  it('声かけ文面で予約リンクが空 → 「ご予約はこちらからどうぞ。」の行が消える', () => {
    const r = renderTemplate(DEFAULT_KOEKAKE_TEMPLATE, {
      呼び名: 'ゆず',
      自分の名前: 'サンプル美容師',
      前回のメニュー: 'カットと白髪染め',
      経過: '2か月半',
      予約リンク: '',
    })
    expect(r.text).not.toContain('ご予約はこちらからどうぞ。')
    expect(r.text.split('\n')).toHaveLength(4)
    expect(r.unknown).toEqual([])
  })

  it('{予約りんく} と打ち間違えた → そのまま残り、黄色く示される', () => {
    const body = 'ご予約はこちら {予約りんく}\n{呼び名}さん'
    const r = renderTemplate(body, { 呼び名: 'ゆず', 予約リンク: 'https://example.com/booking' })
    expect(r.text).toBe('ご予約はこちら {予約りんく}\nゆずさん')
    expect(r.unknown).toEqual(['予約りんく'])
    expect(splitUnknownPlaceholders(r.text, ['呼び名', '予約リンク'])).toEqual([
      { text: 'ご予約はこちら ', unknown: false },
      { text: '{予約りんく}', unknown: true },
      { text: '\nゆずさん', unknown: false },
    ])
  })

  it('{自分の名前} が空なら行ごと消す', () => {
    const r = renderTemplate(DEFAULT_KOEKAKE_TEMPLATE, {
      呼び名: 'ゆず',
      自分の名前: '',
      前回のメニュー: 'カット',
      経過: '6週間',
      予約リンク: 'https://example.com/booking',
    })
    expect(r.text).not.toContain('美容師の')
  })

  it('メニュー名のつなぎ方', () => {
    expect(joinMenuNames(['カット'])).toBe('カット')
    expect(joinMenuNames(['カット', '白髪染め'])).toBe('カットと白髪染め')
    expect(joinMenuNames(['カット', 'カラー', 'トリートメント'])).toBe('カット・カラー・トリートメント')
  })

  it('{次回の目安}: 予約・目安・おまかせ', () => {
    expect(nextPhrase('2026-11-07', { kind: 'booked', date: '2026-12-19' })).toBe('12月19日（土）ご予約済み')
    expect(nextPhrase('2026-11-07', { kind: 'agreed', amount: 6, unit: 'week' })).toBe('12月中旬ごろ')
    expect(nextPhrase('2026-11-07', { kind: 'omakase' })).toBe('')
    expect(nextPhrase('2026-11-07', { kind: 'none' })).toBe('')
  })

  it('またねカード: おまかせなら次回の目安の行を消す。所属サロンの客は所属サロン用のリンク（なければ行を消す）', () => {
    const s = settings({ stylistName: 'サンプル美容師', bookingLink: { self: 'https://example.com/booking' } })
    const salon = cust('a', { nickname: 'あんず', stewardship: { steward: 'salon', channel: 'salon_media', decidedOn: '2026-01-01' } })
    const r = renderMatane({
      body: DEFAULT_MATANE_TEMPLATE,
      customer: salon,
      visit: { date: '2026-11-07', menuIds: ['cut', 'color'], next: { kind: 'omakase' } },
      menus: MENUS,
      settings: s,
    })
    expect(r.text).toBe(['あんずさん、今日はありがとうございました。', '今日のメニュー：カットとカラー', 'サンプル美容師'].join('\n'))
    const r2 = renderMatane({
      body: DEFAULT_MATANE_TEMPLATE,
      customer: salon,
      visit: { date: '2026-11-07', menuIds: ['cut'], next: { kind: 'omakase' } },
      menus: MENUS,
      settings: { ...s, bookingLink: { self: 'https://example.com/booking', salon: 'https://example.org/salon' } },
    })
    expect(r2.text).toContain('ご予約はこちらからどうぞ。 https://example.org/salon')
    expect(r2.text).not.toContain('https://example.com/booking')
  })

  it('LINE共有リンクは https://line.me/R/share?text= で始まり、デコードすると文面に戻る', () => {
    const text = 'ゆずさん、こんにちは。\n100% & ?'
    const url = lineShareUrl(text)
    expect(url.startsWith('https://line.me/R/share?text=')).toBe(true)
    expect(decodeURIComponent(url.slice('https://line.me/R/share?text='.length))).toBe(text)
  })
})
