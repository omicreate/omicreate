import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import {
  CANDIDATE_LABEL_TEXT,
  dormantSummaryText,
  eligibility,
  exclusionSummaryText,
} from './eligibility'
import { MENUS, T, cust, koekake, settings, visit, visitsFromGaps } from '../test/factories'
import type { ContactLog, Customer, Settings, Visit } from './types'

/** ご無沙汰の客（カラー1回、E=70、I=60） */
function overdueVisit(id: string): Visit {
  return visit(id, addDays(T, -70), { menuIds: ['color'] })
}

function run(customers: Customer[], visits: Visit[], contacts: ContactLog[] = [], s: Partial<Settings> = {}, today = T) {
  return eligibility({ customers, visits, contacts, menus: MENUS, settings: settings(s), today })
}

describe('6.6 声かけ候補（eligibility）', () => {
  it('最後の声かけが29日前 → 除外（cooldown）', () => {
    const r = run([cust('a')], [overdueVisit('a')], [koekake('a', addDays(T, -29))])
    expect(r.candidates).toHaveLength(0)
    expect(r.excluded.map((e) => e.reason)).toEqual(['cooldown'])
  })

  it('最後の声かけがちょうど30日前 → 候補', () => {
    const r = run([cust('a')], [overdueVisit('a')], [koekake('a', addDays(T, -30))])
    expect(r.candidates.map((c) => c.customer.id)).toEqual(['a'])
  })

  it('最後の来店のあとに声かけ2回 → 除外（max_contacts）', () => {
    const r = run([cust('a')], [overdueVisit('a')], [koekake('a', addDays(T, -60)), koekake('a', addDays(T, -40))])
    expect(r.excluded.map((e) => e.reason)).toEqual(['max_contacts'])
  })

  it('最後の来店より前の声かけは回数に数えない', () => {
    const r = run([cust('a')], [overdueVisit('a')], [koekake('a', addDays(T, -100)), koekake('a', addDays(T, -90))])
    expect(r.candidates).toHaveLength(1)
  })

  it('snoozeUntil = 今日 → 除外（snoozed）', () => {
    const r = run([cust('a', { snoozeUntil: T })], [overdueVisit('a')])
    expect(r.excluded.map((e) => e.reason)).toEqual(['snoozed'])
  })

  it('snoozeUntil = 昨日 → 候補', () => {
    const r = run([cust('a', { snoozeUntil: addDays(T, -1) })], [overdueVisit('a')])
    expect(r.candidates).toHaveLength(1)
  })

  it('所属サロンの顧客で overdue → 除外（salon）', () => {
    const c = cust('a', { stewardship: { steward: 'salon', channel: 'salon_media', decidedOn: '2026-01-01' } })
    const r = run([c], [overdueVisit('a')])
    expect(r.excluded.map((e) => e.reason)).toEqual(['salon'])
  })

  it("permission = 'unknown' → 候補（ラベルつき）。onlyContactOkInList が true なら除外", () => {
    const c = cust('a', { contact: { permission: 'unknown' } })
    const r1 = run([c], [overdueVisit('a')])
    expect(r1.candidates).toHaveLength(1)
    expect(r1.candidates[0].labels).toContain('contact_unconfirmed')
    const r2 = run([c], [overdueVisit('a')], [], { onlyContactOkInList: true })
    expect(r2.excluded.map((e) => e.reason)).toEqual(['not_confirmed_ok'])
  })

  it("permission = 'no' → 除外（no_contact）", () => {
    const r = run([cust('a', { contact: { permission: 'no' } })], [overdueVisit('a')])
    expect(r.excluded.map((e) => e.reason)).toEqual(['no_contact'])
  })

  it('除外理由は最初に当てはまったものだけ（salon が先）', () => {
    const c = cust('a', {
      stewardship: { steward: 'salon', channel: 'salon_handover', decidedOn: '2026-01-01' },
      contact: { permission: 'no' },
      snoozeUntil: T,
    })
    const r = run([c], [overdueVisit('a')], [koekake('a', addDays(T, -1))])
    expect(r.excluded.map((e) => e.reason)).toEqual(['salon'])
    expect(r.summary).toMatchObject({ salon: 1, no_contact: 0, snoozed: 0, cooldown: 0 })
  })

  it('区分が soon / overdue / lapsed 以外は候補にも要約にも入らない', () => {
    const customers = [cust('notyet'), cust('booked'), cust('confirm'), cust('dormant'), cust('none')]
    const visits = [
      visit('notyet', addDays(T, -10)),
      visit('booked', addDays(T, -10), { next: { kind: 'booked', date: addDays(T, 5) } }),
      visit('confirm', addDays(T, -70), { next: { kind: 'booked', date: addDays(T, -3) } }),
      visit('dormant', addDays(T, -400)),
    ]
    const r = run(customers, visits)
    expect(r.candidates).toHaveLength(0)
    expect(r.excluded).toHaveLength(0)
    expect(r.dormant.map((d) => d.customer.id)).toEqual(['dormant'])
    expect(r.dueById.get('confirm')?.status).toBe('confirm')
  })

  it('並べ方: E/I の大きい順 → E の大きい順 → 呼び名の五十音順', () => {
    const customers = [
      cust('x1', { nickname: 'さくら' }),
      cust('x2', { nickname: 'あおい' }),
      cust('x3', { nickname: 'かえで' }),
      cust('x4', { nickname: 'いちご' }),
    ]
    const visits = [
      // カラー（I=60）E=90 → 1.5
      visit('x1', addDays(T, -90), { menuIds: ['color'] }),
      // 白髪染め（I=42）E=63 → 1.5、E は小さい
      visit('x2', addDays(T, -63), { menuIds: ['gray'] }),
      // カラー E=70 → 1.1666
      visit('x3', addDays(T, -70), { menuIds: ['color'] }),
      // カラー E=70（同じ割合・同じ E → 呼び名順）
      visit('x4', addDays(T, -70), { menuIds: ['color'] }),
    ]
    const r = run(customers, visits)
    expect(r.candidates.map((c) => c.customer.nickname)).toEqual(['さくら', 'あおい', 'いちご', 'かえで'])
  })

  it('表示は listLimit 人まで、残りは［ほかに○人］', () => {
    const customers = Array.from({ length: 7 }, (_, i) => cust(`c${i}`))
    const visits = customers.map((c) => overdueVisit(c.id))
    const r = run(customers, visits)
    expect(r.shown).toHaveLength(5)
    expect(r.moreCount).toBe(2)
    expect(run(customers, visits, [], { listLimit: 3 }).moreCount).toBe(4)
  })

  it('ラベル: おおよそ・はじめて', () => {
    const customers = [cust('approx', { contact: { permission: 'unknown' } }), cust('first'), cust('bulk1'), cust('two')]
    const visits = [
      visit('approx', '2026-07-31', { dateApprox: 'month', source: 'bulk', menuIds: ['straight'], next: { kind: 'none' } }),
      overdueVisit('first'),
      visit('bulk1', addDays(T, -70), { source: 'bulk' }),
      ...visitsFromGaps('two', [60], addDays(T, -70)),
    ]
    const r = run(customers, visits)
    const labels = Object.fromEntries(r.candidates.map((c) => [c.customer.id, c.labels]))
    expect(labels.approx).toEqual(['contact_unconfirmed', 'approx_last_visit'])
    expect(labels.first).toEqual(['first_visit'])
    expect(labels.bulk1).toEqual([])
    expect(labels.two).toEqual([])
    expect(CANDIDATE_LABEL_TEXT.approx_last_visit).toBe('最終来店はおおよそ')
    expect(CANDIDATE_LABEL_TEXT.contact_unconfirmed).toBe('連絡OKは未確認')
    expect(CANDIDATE_LABEL_TEXT.first_visit).toBe('はじめて')
  })

  it('要約の文言', () => {
    const s = settings()
    expect(
      exclusionSummaryText({ salon: 1, no_contact: 1, not_confirmed_ok: 0, snoozed: 0, max_contacts: 0, cooldown: 1 }, s),
    ).toBe('所属サロンの顧客 1人・連絡しない 1人・声をかけてから30日以内 1人は出していません')
    expect(
      exclusionSummaryText({ salon: 0, no_contact: 0, not_confirmed_ok: 0, snoozed: 0, max_contacts: 0, cooldown: 0 }, s),
    ).toBeNull()
    expect(dormantSummaryText(2)).toBe('1年以上来ていない人 2人')
    expect(dormantSummaryText(0)).toBeNull()
  })

  it('削除印つきの客・記録・声かけは計算から除く', () => {
    const r1 = run([cust('a', { deletedAt: '2026-11-07T00:00:00Z' })], [overdueVisit('a')])
    expect(r1.candidates).toHaveLength(0)
    const r2 = run([cust('a')], [overdueVisit('a')], [koekake('a', addDays(T, -1), { deletedAt: '2026-11-07T00:00:00Z' })])
    expect(r2.candidates).toHaveLength(1)
  })
})
