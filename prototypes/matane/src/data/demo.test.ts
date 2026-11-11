import { describe, expect, it } from 'vitest'
import { buildDemoData, SAMPLE_BOOKING_LINK, SAMPLE_IDS } from './demo'
import {
  board,
  boardCopyText,
  buildHomeModel,
  computeDueInfo,
  contactedText,
  createContactLog,
  createVisit,
  detectHealthWords,
  dueBasisLine,
  dueBasisReason,
  eligibility,
  formatDateWithWeekday,
  menuNames,
  nextPhrase,
  notContactedText,
  promiseText,
  recordStaleness,
  renderKoekake,
  renderMatane,
  STATUS_LABELS,
  todaysCustomers,
  type BackupPayload,
  type ContactLog,
  type Visit,
} from '../domain'

const T = '2026-11-07'
const NOW = '2026-11-07T00:30:00.000Z'

function home(data: BackupPayload, today = T, isSample = true) {
  return buildHomeModel({
    customers: data.customers,
    visits: data.visits,
    contacts: data.contacts,
    menus: data.menus,
    settings: { ...data.settings },
    counters: data.counters,
    today,
    isSample,
  })
}

function dueOf(data: BackupPayload, id: string, today = T, visits: Visit[] = data.visits) {
  const c = data.customers.find((x) => x.id === id)!
  return computeDueInfo(c, visits, data.menus, data.settings, today)
}

function koekakeBody(data: BackupPayload) {
  return data.templates.find((t) => t.kind === 'koekake')!.body
}

function mataneBody(data: BackupPayload) {
  return data.templates.find((t) => t.kind === 'matane')!.body
}

describe('8.2 サンプルデータの中身', () => {
  const data = buildDemoData(T, NOW)

  it('10人・植物の名前・設定', () => {
    expect(data.customers.map((c) => c.nickname)).toEqual([
      'もみじ',
      'すずらん',
      'かりん',
      'ゆず',
      'つばき',
      'なずな',
      'あんず',
      'こむぎ',
      'わかば',
      'ひいらぎ',
    ])
    expect(data.settings.stylistName).toBe('サンプル美容師')
    expect(data.settings.bookingLink).toEqual({ self: SAMPLE_BOOKING_LINK })
    expect(data.contacts.map((c) => [c.customerId, c.date, c.kind, c.via])).toEqual([
      [SAMPLE_IDS.karin, '2026-09-13', 'koekake', 'line_link'],
      [SAMPLE_IDS.nazuna, '2026-10-28', 'koekake', 'copy'],
    ])
    // ひいらぎ以外はすべて checkout
    expect(data.visits.filter((v) => v.source !== 'checkout').map((v) => v.customerId)).toEqual([SAMPLE_IDS.hiiragi])
    // チップに出すメニュー
    expect(data.menus.filter((m) => m.visible).map((m) => m.name)).toEqual([
      'カット',
      'カラー',
      '白髪染め',
      'ブリーチ',
      'パーマ',
      '縮毛矯正',
      'トリートメント',
    ])
    // メモに健康の語を入れない
    const memos = [
      ...data.customers.map((c) => c.pinnedMemo ?? ''),
      ...data.visits.map((v) => `${v.talkMemo ?? ''} ${v.recipe?.text ?? ''}`),
    ]
    for (const m of memos) expect(detectHealthWords(m)).toEqual([])
  })

  it('来店日（今日からの日数）と最終来店の次回', () => {
    const dates = (id: string) => data.visits.filter((v) => v.customerId === id).map((v) => v.date)
    expect(dates(SAMPLE_IDS.momiji)).toEqual(['2026-07-04', '2026-08-15', '2026-09-26'])
    expect(dates(SAMPLE_IDS.suzuran)).toEqual(['2026-03-02', '2026-05-01', '2026-06-30', '2026-10-03'])
    expect(dates(SAMPLE_IDS.karin)).toEqual(['2026-04-03', '2026-05-29', '2026-07-24', '2026-09-18'])
    expect(dates(SAMPLE_IDS.yuzu)).toEqual(['2026-03-07', '2026-05-02', '2026-06-27', '2026-08-22'])
    expect(dates(SAMPLE_IDS.tsubaki)).toEqual(['2026-02-20', '2026-04-21', '2026-06-20'])
    expect(dates(SAMPLE_IDS.nazuna)).toEqual(['2026-06-06', '2026-07-18', '2026-08-29'])
    expect(dates(SAMPLE_IDS.anzu)).toEqual(['2026-04-21', '2026-06-20', '2026-08-19'])
    expect(dates(SAMPLE_IDS.komugi)).toEqual(['2026-04-11', '2026-06-10', '2026-08-19'])
    expect(dates(SAMPLE_IDS.wakaba)).toEqual(['2026-11-02'])
    expect(dates(SAMPLE_IDS.hiiragi)).toEqual(['2026-07-31'])
    const momiji = data.visits.filter((v) => v.customerId === SAMPLE_IDS.momiji)
    expect(momiji.map((v) => v.next)).toEqual([
      { kind: 'agreed', amount: 6, unit: 'week' },
      { kind: 'agreed', amount: 6, unit: 'week' },
      { kind: 'booked', date: '2026-11-07' },
    ])
    const suzuran = data.visits.filter((v) => v.customerId === SAMPLE_IDS.suzuran)
    expect(suzuran.map((v) => v.next.kind)).toEqual(['omakase', 'omakase', 'omakase', 'booked'])
    const hiiragi = data.visits.find((v) => v.customerId === SAMPLE_IDS.hiiragi)!
    expect(hiiragi).toMatchObject({ dateApprox: 'month', source: 'bulk', next: { kind: 'none' }, menuIds: ['straight'] })
  })

  it('2026-11-07 の判定（8.2 の右端の列）', () => {
    const expected: Record<string, [string, number?, number?, number?]> = {
      [SAMPLE_IDS.momiji]: ['today'],
      [SAMPLE_IDS.suzuran]: ['confirm'],
      [SAMPLE_IDS.karin]: ['soon', 56, 50],
      [SAMPLE_IDS.yuzu]: ['overdue', 56, 77],
      [SAMPLE_IDS.tsubaki]: ['lapsed', 60, 140],
      [SAMPLE_IDS.nazuna]: ['lapsed', 42, 70],
      [SAMPLE_IDS.anzu]: ['overdue', 60, 80],
      [SAMPLE_IDS.komugi]: ['overdue', 65, 80],
      [SAMPLE_IDS.wakaba]: ['not_yet'],
      [SAMPLE_IDS.hiiragi]: ['overdue', undefined, 99, 90],
    }
    for (const [id, [st, cycle, E, I]] of Object.entries(expected)) {
      const due = dueOf(data, id)
      expect(due.status, id).toBe(st)
      if (cycle !== undefined) expect(due.personalCycleDays, id).toBe(cycle)
      if (E !== undefined) expect(due.elapsedDays, id).toBe(E)
      if (I !== undefined) expect(due.intervalDays, id).toBe(I)
    }
    expect(dueOf(data, SAMPLE_IDS.wakaba).dueDate).toBe('2026-12-14')
    expect(dueOf(data, SAMPLE_IDS.hiiragi).basis).toBe('menu')
  })
})

describe('8.3 ホームの期待値（AC-01 の計算部分）', () => {
  const data = buildDemoData(T, NOW)
  const h = home(data)

  it('今日のお客様＝もみじ、来た？＝すずらん（予約 11/4）', () => {
    expect(h.todays.map((x) => [x.customer.nickname, x.recorded])).toEqual([['もみじ', false]])
    expect(h.todays[0].previousVisit?.recipe?.text).toBe('根元 ブラウン6＋グレー8 1:1／6%／30分')
    expect(h.confirms.map((x) => [x.customer.nickname, x.bookedDate])).toEqual([['すずらん', '2026-11-04']])
  })

  it('声をかけてもよさそうな人＝つばき → ゆず → ひいらぎ → かりん の4人', () => {
    const c = h.eligibility.candidates
    expect(c.map((x) => x.customer.nickname)).toEqual(['つばき', 'ゆず', 'ひいらぎ', 'かりん'])
    expect(c.map((x) => STATUS_LABELS[x.due.status])).toEqual(['離れたかも', 'ご無沙汰', 'ご無沙汰', 'そろそろ'])
    expect(c[0].labels).toEqual(['contact_unconfirmed'])
    expect(c[2].labels).toEqual(expect.arrayContaining(['approx_last_visit', 'contact_unconfirmed']))
    expect(h.eligibility.shown).toHaveLength(4)
    expect(h.eligibility.moreCount).toBe(0)
    const names = c.map((x) => x.customer.nickname)
    for (const n of ['あんず', 'こむぎ', 'なずな', 'わかば']) expect(names).not.toContain(n)
  })

  it('要約＝「所属サロンの顧客 1人・連絡しない 1人・声をかけてから30日以内 1人は出していません」', () => {
    expect(h.exclusionSummary).toBe('所属サロンの顧客 1人・連絡しない 1人・声をかけてから30日以内 1人は出していません')
    expect(h.dormantSummary).toBeNull()
    expect(h.eligibility.summary).toEqual({ salon: 1, no_contact: 1, not_confirmed_ok: 0, snoozed: 0, max_contacts: 0, cooldown: 1 })
  })

  it('記録停止の表示なし（最後の記録 11-02、5日前）。本番用として計算しても出ない', () => {
    expect(h.notice).toBeNull()
    const r = recordStaleness({
      customers: data.customers,
      visits: data.visits,
      counters: data.counters,
      settings: data.settings,
      today: T,
      isSample: false,
    })
    expect(r).toEqual({ show: false, days: 5 })
  })

  it('候補カードの根拠の1行', () => {
    const c = h.eligibility.candidates
    expect(dueBasisLine(c[1].due, data.menus)).toBe('いつもは約8週ごと → 今回は11週')
    expect(dueBasisLine(c[2].due, data.menus)).toBe('目安 約90日（縮毛矯正）→ 99日')
  })
})

describe('8.3 ゆずの声かけ画面', () => {
  const data = buildDemoData(T, NOW)
  const yuzu = data.customers.find((c) => c.id === SAMPLE_IDS.yuzu)!
  const due = dueOf(data, SAMPLE_IDS.yuzu)

  it('「いつもは約8週ごと → 今回は11週」「記録上の最終来店 2026-08-22（土）・77日前・カット・白髪染め」', () => {
    expect(dueBasisLine(due, data.menus)).toBe('いつもは約8週ごと → 今回は11週')
    expect(dueBasisReason(due, data.menus, data.settings)).toBe('いつもの周期（直近3回）')
    const last = due.lastVisit!
    expect(`${formatDateWithWeekday(last.date)}・${due.elapsedDays}日前・${menuNames(last.menuIds, data.menus).join('・')}`).toBe(
      '2026-08-22（土）・77日前・カット・白髪染め',
    )
  })

  it('文面が 8.3 と完全一致し、割引・OFF・クーポン・%・メモを含まない（AC-02・AC-16）', () => {
    const r = renderKoekake({ body: koekakeBody(data), customer: yuzu, due, menus: data.menus, settings: data.settings })!
    expect(r.text).toBe(
      [
        'ゆずさん、こんにちは。',
        '美容師のサンプル美容師です。',
        '前回のカットと白髪染めから2か月半ほどたちましたが、髪の調子はいかがですか？',
        'ご予約はこちらからどうぞ。 https://example.com/booking',
        '気になることがあれば、このままお返事ください。',
      ].join('\n'),
    )
    expect(r.unknown).toEqual([])
    for (const w of ['割引', 'OFF', 'クーポン', '%', '娘さんの受験']) expect(r.text).not.toContain(w)
  })
})

describe('8.3 もみじを今日6週で記録したときのまたねカード（AC-05 の計算部分）', () => {
  const data = buildDemoData(T, NOW)
  const momiji = data.customers.find((c) => c.id === SAMPLE_IDS.momiji)!
  const prev = data.visits.filter((v) => v.customerId === SAMPLE_IDS.momiji).at(-1)!
  const todayVisit = createVisit({
    customerId: momiji.id,
    date: T,
    menuIds: prev.menuIds,
    next: { kind: 'agreed', amount: 6, unit: 'week' },
    source: 'checkout',
    now: NOW,
  })

  it('「次回の目安：12月中旬ごろ」（2026-12-19）と自分用の予約リンク。メモは入らない', () => {
    expect(nextPhrase(T, todayVisit.next)).toBe('12月中旬ごろ')
    const r = renderMatane({ body: mataneBody(data), customer: momiji, visit: todayVisit, menus: data.menus, settings: data.settings })
    expect(r.text).toBe(
      [
        'もみじさん、今日はありがとうございました。',
        '今日のメニュー：カットと白髪染め',
        '次回の目安：12月中旬ごろ',
        'ご予約はこちらからどうぞ。 https://example.com/booking',
        'サンプル美容師',
      ].join('\n'),
    )
    expect(r.text).not.toContain('根元')
    expect(r.text).not.toContain('前髪')
  })

  it('記録すると、もみじは「記録済み」になり、目安は 12-19（目安）', () => {
    const visits = [...data.visits, todayVisit]
    const list = todaysCustomers(data.customers, visits, T)
    expect(list.map((x) => [x.customer.nickname, x.recorded])).toEqual([['もみじ', true]])
    const due = dueOf(data, SAMPLE_IDS.momiji, T, visits)
    expect(due).toMatchObject({ dueDate: '2026-12-19', basis: 'agreed', status: 'not_yet' })
  })
})

describe('AC-04 声かけ後のクールダウン（計算部分）', () => {
  const data = buildDemoData(T, NOW)
  const sent: ContactLog = createContactLog({ customerId: SAMPLE_IDS.yuzu, date: T, kind: 'koekake', via: 'line_link', now: NOW })
  const contacts = [...data.contacts, sent]
  const names = (today: string) =>
    eligibility({ customers: data.customers, visits: data.visits, contacts, menus: data.menus, settings: data.settings, today }).candidates.map(
      (c) => c.customer.nickname,
    )

  it('［送った］の直後にゆずは候補から消える', () => {
    expect(names(T)).toEqual(['つばき', 'ひいらぎ', 'かりん'])
  })

  it('2026-12-06 は除外（cooldown）', () => {
    const r = eligibility({
      customers: data.customers,
      visits: data.visits,
      contacts,
      menus: data.menus,
      settings: data.settings,
      today: '2026-12-06',
    })
    expect(r.candidates.map((c) => c.customer.nickname)).not.toContain('ゆず')
    expect(r.excluded.find((e) => e.customer.id === SAMPLE_IDS.yuzu)?.reason).toBe('cooldown')
  })

  it('2026-12-07 は候補に戻る（来店がなければ）', () => {
    expect(names('2026-12-07')).toContain('ゆず')
  })
})

describe('AC-03 ［実は来ていた］の計算部分', () => {
  it('ゆずに 2026-11-01 の来店を足すと候補が3人になり、ゆずは「まだ」', () => {
    const data = buildDemoData(T, NOW)
    const fix = createVisit({
      customerId: SAMPLE_IDS.yuzu,
      date: '2026-11-01',
      menuIds: ['cut', 'gray'],
      next: { kind: 'none' },
      source: 'fix',
      now: NOW,
    })
    const visits = [...data.visits, fix]
    const h = buildHomeModel({
      customers: data.customers,
      visits,
      contacts: data.contacts,
      menus: data.menus,
      settings: data.settings,
      counters: data.counters,
      today: T,
      isSample: true,
    })
    expect(h.eligibility.candidates.map((c) => c.customer.nickname)).toEqual(['つばき', 'ひいらぎ', 'かりん'])
    expect(STATUS_LABELS[dueOf(data, SAMPLE_IDS.yuzu, T, visits).status]).toBe('まだ')
  })
})

describe('AC-17 わたしの再来ボード', () => {
  const data = buildDemoData(T, NOW)
  const b = board({
    customers: data.customers,
    visits: data.visits,
    contacts: data.contacts,
    menus: data.menus,
    settings: data.settings,
    today: T,
  })

  it('稼働顧客数 10人（先月末 9人）', () => {
    expect(b.active).toMatchObject({ now: 10, lastMonthEnd: 9, lastMonthEndDate: '2026-10-31' })
  })

  it('次回の約束あり 今月 1件中1件（目安1）、先月 1件中1件（予約1）', () => {
    expect(b.promise?.thisMonth).toMatchObject({ month: '2026-11', total: 1, kept: 1, booked: 0, agreed: 1 })
    expect(b.promise?.lastMonth).toMatchObject({ month: '2026-10', total: 1, kept: 1, booked: 1, agreed: 0 })
    expect(promiseText(b.promise!.thisMonth)).toBe('1件中1件（目安1）')
    expect(promiseText(b.promise!.lastMonth)).toBe('1件中1件（予約1）')
  })

  it('声かけと戻り（60日、S = 2026-09-08）: 声かけ2人中1人、しなかったご無沙汰2人中1人', () => {
    const k = b.koekake!
    expect(k.since).toBe('2026-09-08')
    expect(k.contacted).toMatchObject({ count: 2, returned: 1 })
    expect(new Set(k.contacted.customerIds)).toEqual(new Set([SAMPLE_IDS.karin, SAMPLE_IDS.nazuna]))
    expect(k.contacted.returnedIds).toEqual([SAMPLE_IDS.karin])
    expect(k.notContacted).toMatchObject({ count: 2, returned: 1 })
    expect(new Set(k.notContacted.customerIds)).toEqual(new Set([SAMPLE_IDS.suzuran, SAMPLE_IDS.tsubaki]))
    expect(k.notContacted.returnedIds).toEqual([SAMPLE_IDS.suzuran])
    expect(contactedText(k.contacted)).toBe('声かけした人 2人 → その後来店 1人')
    expect(notContactedText(k.notContacted)).toBe('声かけしなかったご無沙汰の人 2人 → その後来店 1人')
  })

  it('［数字をコピー］の文字列に呼び名・「円」・「%」を含まない', () => {
    const text = boardCopyText({ board: b, visits: data.visits, counters: data.counters, settings: data.settings, today: T })
    for (const c of data.customers) expect(text).not.toContain(c.nickname)
    expect(text).not.toContain('円')
    expect(text).not.toContain('%')
    expect(text).toContain('稼働顧客数: 10人（先月末 9人）')
    expect(text).toContain('直近28日の来店記録: 1件')
  })

  it('来店記録がなければ empty', () => {
    const e = board({ customers: [], visits: [], contacts: [], menus: data.menus, settings: data.settings, today: T })
    expect(e.empty).toBe(true)
    expect(promiseText(e.promise!.thisMonth)).toBe('記録なし')
  })
})

describe('サンプルは起動した日からの相対日数で作る', () => {
  it.each(['2026-12-01', '2026-12-31', '2027-03-15', '2027-07-31'])('今日 = %s でもホームの並びが同じ', (today) => {
    const data = buildDemoData(today, NOW)
    const h = home(data, today)
    expect(h.todays.map((x) => x.customer.nickname)).toEqual(['もみじ'])
    expect(h.confirms.map((x) => x.customer.nickname)).toEqual(['すずらん'])
    expect(h.eligibility.candidates.map((x) => x.customer.nickname)).toEqual(['つばき', 'ゆず', 'ひいらぎ', 'かりん'])
    expect(h.exclusionSummary).toBe('所属サロンの顧客 1人・連絡しない 1人・声をかけてから30日以内 1人は出していません')
  })
})
