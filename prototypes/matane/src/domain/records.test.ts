import { describe, expect, it } from 'vitest'
import {
  applyVisitToCustomer,
  archiveCustomer,
  copyRecipeFrom,
  createBulkRecords,
  createCustomer,
  snoozeUntilFor,
  unarchiveCustomer,
  withContactPermission,
} from './records'
import { defaultStewardForChannel } from './labels'
import { validateBookingLink, validateNickname, validateVisitInput, parsePriceInput, VALIDATION_MESSAGES } from './validation'
import { T, cust, visit } from '../test/factories'

const NOW = '2026-11-07T01:00:00.000Z'

describe('記録を作る・直す', () => {
  it('顧客の連絡の初期値は未確認。stewardship は必須', () => {
    const c = createCustomer({ nickname: ' さくら ', steward: 'self', channel: 'own_sns', today: T, now: NOW })
    expect(c.nickname).toBe('さくら')
    expect(c.contact).toEqual({ permission: 'unknown' })
    expect(c.stewardship).toEqual({ steward: 'self', channel: 'own_sns', decidedOn: T })
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('獲得経路がサロン媒体・サロンからの引き継ぎなら管理者の初期値は所属サロン（AC-11）', () => {
    expect(defaultStewardForChannel('salon_media')).toBe('salon')
    expect(defaultStewardForChannel('salon_handover')).toBe('salon')
    expect(defaultStewardForChannel('own_line')).toBe('self')
    expect(defaultStewardForChannel('unknown')).toBe('self')
  })

  it('ざっくり登録「ひいらぎ／7月／縮毛矯正」→ 最終来店 2026-07-31（おおよそ、bulk）', () => {
    const r = createBulkRecords({ nickname: 'ひいらぎ', lastVisitText: '7月', menuIds: ['straight'], steward: 'self', channel: 'unknown', today: T, now: NOW })
    expect(r.visit).toMatchObject({ date: '2026-07-31', dateApprox: 'month', source: 'bulk', menuIds: ['straight'], next: { kind: 'none' } })
    const bad = createBulkRecords({ nickname: 'あおい', lastVisitText: '13月', menuIds: [], steward: 'self', channel: 'unknown', today: T, now: NOW })
    expect(bad.visit).toBeUndefined()
    expect(bad.parse.kind).toBe('error')
  })

  it('来店を保存すると、リストから外していた客を戻す', () => {
    const c = cust('a', { archived: { on: '2026-10-01', reason: 'other' }, contact: { permission: 'unknown' } })
    const r = applyVisitToCustomer(c, { permission: 'ok', today: T, now: NOW })
    expect(r.unarchived).toBe(true)
    expect(r.customer.archived).toBeUndefined()
    expect(r.customer.contact).toEqual({ permission: 'ok', confirmedOn: T, method: 'in_person' })
    expect(applyVisitToCustomer(cust('b'), { today: T, now: NOW }).changed).toBe(false)
  })

  it('既存の来店記録を直しただけでは、リストから外した客を戻さない', () => {
    const c = cust('a', { archived: { on: '2026-10-01', reason: 'moved' } })
    const r = applyVisitToCustomer(c, { today: T, now: NOW, editing: true })
    expect(r.unarchived).toBe(false)
    expect(r.changed).toBe(false)
    expect(r.customer.archived).toEqual({ on: '2026-10-01', reason: 'moved' })
  })

  it('連絡しないにする・リストから外す・戻す', () => {
    expect(withContactPermission(cust('a'), 'no', { today: T, now: NOW }).contact).toEqual({ permission: 'no', confirmedOn: T, method: 'in_person' })
    expect(withContactPermission(cust('a'), 'ok', { today: T, now: NOW, method: 'message' }).contact).toEqual({ permission: 'ok', confirmedOn: T, method: 'message' })
    // 美容師の判断で「連絡しない」にしたときは、本人に確かめた日・方法を残さない
    expect(withContactPermission(cust('a'), 'no', { today: T, now: NOW, method: null }).contact).toEqual({ permission: 'no' })
    const a = archiveCustomer(cust('a'), 'moved', { today: T, now: NOW })
    expect(a.archived).toEqual({ on: T, reason: 'moved' })
    expect(unarchiveCustomer(a, NOW).archived).toBeUndefined()
  })

  it('［今回は見送る］: 2週間＝今日＋14日、次の周期まで＝今日＋目安の間隔', () => {
    expect(snoozeUntilFor('two_weeks', { status: 'overdue', intervalDays: 56 }, T)).toBe('2026-11-21')
    expect(snoozeUntilFor('next_cycle', { status: 'overdue', intervalDays: 56 }, T)).toBe('2027-01-02')
  })

  it('［前回のメモを複製］は複製元を記録する', () => {
    const v = visit('a', '2026-09-26', { recipe: { text: '根元 6% 30分' } })
    expect(copyRecipeFrom(v)).toEqual({ text: '根元 6% 30分', copiedFromVisitId: v.id })
    expect(copyRecipeFrom(visit('a', '2026-09-26'))).toBeUndefined()
  })
})

describe('入力の確かめ（4.3・4.7・4.9）', () => {
  it('来店記録のエラー', () => {
    const base = { date: T, menuIds: ['cut'], next: { kind: 'omakase' as const } }
    expect(validateVisitInput(base, T)).toEqual([])
    expect(validateVisitInput({ ...base, menuIds: [] }, T)).toEqual(['メニューを1つ選んでください'])
    expect(validateVisitInput({ ...base, date: '2026-11-08' }, T)).toEqual(['未来の日付は入れられません。次回の予約は『予約日を入れる』へ'])
    expect(validateVisitInput({ ...base, next: { kind: 'booked', date: T } }, T)).toEqual(['予約日は来店日より後の日付にしてください'])
    expect(validateVisitInput({ ...base, menuIds: [], allowNoMenu: true }, T)).toEqual([])
    expect(validateVisitInput({ ...base, price: -1 }, T)).toEqual([VALIDATION_MESSAGES.price])
  })

  it('呼び名と予約リンク', () => {
    expect(validateNickname('', [])).toEqual({ error: '呼び名を入れてください' })
    expect(validateNickname('あ'.repeat(21), [])).toEqual({ error: '20文字までにしてください' })
    expect(validateNickname('あ'.repeat(20), [])).toEqual({})
    expect(validateNickname('ゆず', [cust('y', { nickname: 'ゆず' })])).toEqual({ warning: '同じ呼び名の方がいます' })
    expect(validateNickname('ゆず', [cust('y', { nickname: 'ゆず' })], 'y')).toEqual({})
    expect(validateBookingLink('http://example.com')).toBe('https:// で始まるURLを入れてください')
    expect(validateBookingLink('https://example.com/booking')).toBeNull()
    expect(validateBookingLink('')).toBeNull()
  })

  it('金額の入力欄', () => {
    expect(parsePriceInput('８，８００円')).toBe(8800)
    expect(parsePriceInput('')).toBeUndefined()
    expect(parsePriceInput('abc')).toBeNull()
  })
})
