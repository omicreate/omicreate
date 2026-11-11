/** 予約日の読み取り（S10）。today は 2026-11-07（土） */
import { describe, expect, it } from 'vitest'
import { BOOKING_DATE_MESSAGES, bookingDateErrorMessage, parseBookingDate } from './bookingDate'

const T = '2026-11-07'

describe('parseBookingDate: 読める書き方', () => {
  const table: Array<[string, string, string?]> = [
    // [入力, 期待する日付, 今日（省略時 2026-11-07）]
    ['2026-11-20', '2026-11-20'],
    ['2026/11/20', '2026-11-20'],
    ['2026年11月20日', '2026-11-20'],
    ['11/20', '2026-11-20'],
    ['11月20日', '2026-11-20'],
    ['20日', '2026-11-20'],
    ['7日', '2026-11-07'],
    ['5日', '2026-12-05'], // 今日より前 → 来月
    ['1/10', '2027-01-10'], // 年のない日付で今日より前・来年のその日が半年以内 → 来年
    ['5月1日', '2027-05-01'], // 来年の5/1 は175日先 → 来年
    // 今月・来月・再来月の何日
    ['今月20日', '2026-11-20'],
    ['今月の20日', '2026-11-20'],
    ['来月20日', '2026-12-20'],
    ['来月の20日', '2026-12-20'],
    ['来月5日', '2026-12-05'],
    ['再来月10日', '2027-01-10'],
    ['来月の5日の14時で', '2026-12-05'],
    // 再来週
    ['再来週火曜', '2026-11-17'],
    ['再来週の火曜日', '2026-11-17'],
    ['再来週(日)', '2026-11-22'],
    ['今日', '2026-11-07'],
    ['本日', '2026-11-07'],
    ['明日', '2026-11-08'],
    ['あした', '2026-11-08'],
    ['明後日', '2026-11-09'],
    ['あさって', '2026-11-09'],
    ['来週火曜', '2026-11-10'],
    ['来週の火曜日', '2026-11-10'],
    ['来週(火)', '2026-11-10'],
    ['来週（火）', '2026-11-10'],
    ['来週月曜', '2026-11-09'],
    ['来週日曜', '2026-11-15'],
    ['来週土曜', '2026-11-14'],
    ['火曜', '2026-11-10'],
    ['金曜日', '2026-11-13'],
    ['土曜日', '2026-11-07'], // 今日がその曜日なら今日
    ['１１／２０', '2026-11-20'], // 全角
    ['２０日', '2026-11-20'],
    ['２０２６－１１－２０', '2026-11-20'],
    ['では20日の14時でお願いします！', '2026-11-20'],
    ['11月20日（金）でお願いします', '2026-11-20'],
    // 来週・曜日の起点
    ['来週月曜', '2026-11-16', '2026-11-09'], // 今日が月曜 → 次の月曜
    ['月曜', '2026-11-09', '2026-11-09'], // 今日が月曜なら今日
    ['来週月曜', '2026-11-09', '2026-11-08'], // 今日が日曜 → 翌日の月曜
    // 月末
    ['31日', '2026-01-31', '2026-01-31'],
    ['30日', '2026-03-30', '2026-01-31'], // 今月は過ぎた・来月（2月）に30日はない → 3月
    ['31日', '2026-12-31', '2026-11-07'], // 11月に31日はない → 12月
    ['2/28', '2027-02-28', '2026-11-07'],
    // 年末をまたぐ
    ['1/5', '2027-01-05', '2026-12-30'],
    ['5日', '2027-01-05', '2026-12-30'],
    ['明後日', '2027-01-01', '2026-12-30'],
    ['明日', '2027-01-01', '2026-12-31'],
    ['来週月曜', '2027-01-04', '2026-12-30'],
    ['来月10日', '2027-01-10', '2026-12-30'],
    ['再来週月曜', '2027-01-11', '2026-12-30'],
    ['来月31日', '2026-12-31', '2026-11-07'],
    ['火曜', '2027-01-05', '2026-12-30'],
  ]
  it.each(table)('%s → %s（今日 %s）', (input, expected, today) => {
    const r = parseBookingDate(input, today ?? T)
    expect(r.date).toBe(expected)
    expect(r.error).toBeNull()
    expect(r.multiple).toBe(false)
  })
})

describe('parseBookingDate: 時刻は読み取っても捨てる', () => {
  it.each([
    ['20日の14時でお願いします！', '2026-11-20'],
    ['11/20 14:00', '2026-11-20'],
    ['11/20 14:00〜15:00', '2026-11-20'],
    ['明日の午後2時', '2026-11-08'],
    ['来週火曜 10時半', '2026-11-10'],
    ['2026-11-20 14:30', '2026-11-20'],
    ['11月20日 14時30分', '2026-11-20'],
  ])('%s → %s（時刻を捨てた）', (input, expected) => {
    const r = parseBookingDate(input, T)
    expect(r.date).toBe(expected)
    expect(r.timeDropped).toBe(true)
    expect(r.multiple).toBe(false)
  })

  it('時刻だけなら読み取れない', () => {
    for (const input of ['14時', '14:00', '午後2時']) {
      const r = parseBookingDate(input, T)
      expect(r.date).toBeNull()
      expect(r.error).toBe('unreadable')
      expect(r.timeDropped).toBe(true)
    }
  })

  it('時刻がなければ timeDropped は false', () => {
    expect(parseBookingDate('11/20', T).timeDropped).toBe(false)
  })
})

describe('parseBookingDate: 2つの日付・読めない・範囲外', () => {
  it('日付が2つあれば最初のものを使い、multiple を立てる', () => {
    const r = parseBookingDate('20日か21日でお願いします', T)
    expect(r.date).toBe('2026-11-20')
    expect(r.multiple).toBe(true)
    const r2 = parseBookingDate('明日がだめなら11/12で', T)
    expect(r2.date).toBe('2026-11-08')
    expect(r2.multiple).toBe(true)
  })

  it('同じ日付の言い換えや曜日の添え書きは2つと数えない', () => {
    expect(parseBookingDate('明日（11月8日）', T).multiple).toBe(false)
    expect(parseBookingDate('11月20日金曜日', T).multiple).toBe(false)
    expect(parseBookingDate('20日(金)', T).multiple).toBe(false)
  })

  it('読み取れなければ unreadable、空なら empty（文言なし）', () => {
    expect(parseBookingDate('よろしくお願いします', T).error).toBe('unreadable')
    expect(parseBookingDate('2月30日', T).error).toBe('unreadable')
    expect(parseBookingDate('13/40', T).error).toBe('unreadable')
    expect(parseBookingDate('', T).error).toBe('empty')
    expect(parseBookingDate('   ', T).error).toBe('empty')
    expect(bookingDateErrorMessage('unreadable')).toBe('日付が読み取れませんでした。カレンダーで選んでください')
    expect(bookingDateErrorMessage('empty')).toBeNull()
  })

  it('範囲は今日〜365日先。過去・範囲外はエラー（日付は返す）', () => {
    expect(parseBookingDate('2026-11-06', T)).toMatchObject({ date: '2026-11-06', error: 'past' })
    expect(parseBookingDate('2027-11-07', T)).toMatchObject({ date: '2027-11-07', error: null })
    expect(parseBookingDate('2027-11-08', T)).toMatchObject({ date: '2027-11-08', error: 'too_far' })
    expect(bookingDateErrorMessage('past')).toBe(BOOKING_DATE_MESSAGES.past)
    expect(bookingDateErrorMessage('too_far')).toBe(BOOKING_DATE_MESSAGES.tooFar)
  })

  it('文言', () => {
    expect(BOOKING_DATE_MESSAGES.multiple).toBe('日付が2つありました。合っているか確かめてください')
    expect(BOOKING_DATE_MESSAGES.timeDropped).toBe('時刻は残しません')
  })
})

describe('parseBookingDate: 数えて決める言い方・ずれやすい書き方は読まない（別の日にしない）', () => {
  it.each([
    '10日後',
    '3日後でお願いします',
    '2週間後の火曜',
    '1週間後',
    '2か月後',
    '先週の火曜',
    '先週(火)',
    '先月の20日',
    '来週あたりで',
    '再来週のどこかで',
  ])('%s → 読めない（カレンダーへ）', (input) => {
    const r = parseBookingDate(input, T)
    expect(r.date).toBeNull()
    expect(r.error).toBe('unreadable')
  })

  it('「来月20日」の「20日」を今月と読まない（日付は1つだけ）', () => {
    expect(parseBookingDate('来月の20日', T)).toMatchObject({ date: '2026-12-20', error: null, multiple: false })
  })

  it('「今月5日」が過ぎていれば過去のエラー', () => {
    expect(parseBookingDate('今月5日', T)).toMatchObject({ date: '2026-11-05', error: 'past' })
  })

  it('年のない月日で今日より前、来年のその日が半年より先なら過去のエラー（打ち間違いを1年先にしない）', () => {
    expect(parseBookingDate('11月1日', T)).toMatchObject({ date: '2026-11-01', error: 'past' })
    expect(parseBookingDate('11/6', T)).toMatchObject({ date: '2026-11-06', error: 'past' })
    expect(parseBookingDate('6月1日', T)).toMatchObject({ date: '2026-06-01', error: 'past' })
  })

  it('ほかの日付のあとにある数える言い方は、2つ目として数える（最初の日付を使い、確かめるよう促す）', () => {
    expect(parseBookingDate('20日、だめなら3日後', T)).toMatchObject({ date: '2026-11-20', error: null, multiple: true })
  })
})
