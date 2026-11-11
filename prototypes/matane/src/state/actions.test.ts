/** 画面の操作から呼ぶ保存の手順（state/actions）の確かめ。メモリ保存で動かす */
import { describe, expect, it } from 'vitest'
import { createMemoryRepository, PROD_DB } from '../storage'
import { archiveCustomer, createCustomer, createVisit, effectiveOpenBooking } from '../domain'
import { cancelBooking, resolveNotVisited, saveBooking, saveVisit, skipKoekake } from './actions'

const T = '2026-11-07'
const NOW = '2026-11-07T03:00:00.000Z'

async function seeded() {
  const repo = createMemoryRepository(PROD_DB)
  const base = createCustomer({ nickname: 'ゆず', steward: 'self', channel: 'own_line', today: T, now: NOW, id: 'c1' })
  const customer = archiveCustomer(base, 'moved', { today: T, now: NOW })
  const visit = createVisit({ customerId: 'c1', date: '2026-08-22', menuIds: ['cut'], next: { kind: 'omakase' }, source: 'checkout', now: NOW, id: 'v1' })
  await repo.saveRecords({ customers: [customer], visits: [visit] })
  return { repo, customer, visit }
}

describe('saveVisit とリストから外した客（4.3）', () => {
  it('既存の来店記録を直しただけでは戻さない（トーストも出さない）', async () => {
    const { repo, customer, visit } = await seeded()
    const res = await saveVisit(repo, {
      customer,
      fields: { date: visit.date, menuIds: visit.menuIds, next: visit.next, talkMemo: '追記' },
      source: 'checkout',
      editing: visit,
      today: T,
      now: NOW,
    })
    expect(res.unarchived).toBe(false)
    expect((await repo.getCustomer('c1'))?.archived).toEqual({ on: T, reason: 'moved' })
    expect((await repo.getVisit('v1'))?.talkMemo).toBe('追記')
  })

  it('新しい来店を残したときは戻す', async () => {
    const { repo, customer } = await seeded()
    const res = await saveVisit(repo, {
      customer,
      fields: { date: T, menuIds: ['cut'], next: { kind: 'none' } },
      source: 'checkout',
      today: T,
      now: NOW,
    })
    expect(res.unarchived).toBe(true)
    expect((await repo.getCustomer('c1'))?.archived).toBeUndefined()
  })
})

describe('skipKoekake（4.5）', () => {
  it('［連絡しないにする］は本人に確かめた日・方法を残さない', async () => {
    const { repo, customer } = await seeded()
    const next = await skipKoekake(repo, { customer, option: 'no_contact', due: { status: 'overdue', intervalDays: 56 }, today: T, now: NOW })
    expect(next.contact).toEqual({ permission: 'no' })
    expect((await repo.getCounters())?.koekakeSkipped).toBe(1)
  })
})

describe('予約を入れる（S10）と片付け', () => {
  const SET_AT = '2026-11-07T03:00:00.000Z'

  async function withBookingSeeded() {
    const repo = createMemoryRepository(PROD_DB)
    const c = createCustomer({ nickname: 'つばき', steward: 'self', channel: 'own_sns', today: T, now: NOW, id: 'c2' })
    const v = createVisit({
      customerId: 'c2',
      date: '2026-06-01',
      menuIds: ['cut'],
      next: { kind: 'booked', date: '2026-11-04' },
      source: 'checkout',
      now: NOW,
      id: 'v2',
    })
    await repo.saveRecords({ customers: [c], visits: [v] })
    const res = await saveBooking(repo, { customer: c, date: '2026-11-20', today: T, now: SET_AT })
    return { repo, customer: res.customer, before: c, visit: v }
  }

  it('saveBooking: 既存の客に日付だけを残す（前の状態を返す）', async () => {
    const { repo, customer, before } = await withBookingSeeded()
    expect((await repo.getCustomer('c2'))?.booking).toEqual({ date: '2026-11-20', setAt: SET_AT })
    expect(customer.booking?.date).toBe('2026-11-20')
    expect(before.booking).toBeUndefined()
  })

  it('saveBooking: 新しいお客様はその場で登録する（必須の管理者・経路つき）', async () => {
    const repo = createMemoryRepository(PROD_DB)
    const res = await saveBooking(repo, {
      newCustomer: { nickname: 'さくら', steward: 'self', channel: 'own_other' },
      date: '2026-11-08',
      today: T,
      now: SET_AT,
    })
    expect(res.created).toBe(true)
    const saved = await repo.getCustomer(res.customer.id)
    expect(saved).toMatchObject({ nickname: 'さくら', stewardship: { steward: 'self', channel: 'own_other' }, booking: { date: '2026-11-08' } })
    expect((await repo.loadAll()).visits).toHaveLength(0)
  })

  it('来店を保存すると、入れた日以降の来店なら予約を消す', async () => {
    const { repo, customer } = await withBookingSeeded()
    await saveVisit(repo, { customer, fields: { date: '2026-11-08', menuIds: ['cut'], next: { kind: 'none' } }, source: 'checkout', today: '2026-11-08', now: '2026-11-08T03:00:00.000Z' })
    expect((await repo.getCustomer('c2'))?.booking).toBeUndefined()
  })

  it('［来なかった］: あとから入れた予約なら customer.booking を消し、取り消しで戻す（カウンタは変えない）', async () => {
    const { repo, customer } = await withBookingSeeded()
    const countersBefore = await repo.getCounters()
    const undo = await resolveNotVisited(repo, { customer, booking: { source: 'customer', date: '2026-11-20', setAt: SET_AT }, now: NOW })
    expect((await repo.getCustomer('c2'))?.booking).toBeUndefined()
    expect((await repo.getVisit('v2'))?.bookingResolution).toBeUndefined()
    expect(await repo.getCounters()).toEqual(countersBefore)
    await undo()
    expect((await repo.getCustomer('c2'))?.booking?.date).toBe('2026-11-20')
  })

  it('［来なかった］: 来店記録の予約なら bookingResolution を付ける（従来どおり）', async () => {
    const { repo, before, visit } = await withBookingSeeded()
    const undo = await resolveNotVisited(repo, {
      customer: before,
      booking: { source: 'visit', date: '2026-11-04', visit: visit as typeof visit & { next: { kind: 'booked'; date: string } } },
      now: NOW,
    })
    expect((await repo.getVisit('v2'))?.bookingResolution).toBe('not_visited')
    await undo()
    expect((await repo.getVisit('v2'))?.bookingResolution).toBeUndefined()
  })

  it('cancelBooking: あとから入れた予約を消し、取り消しで戻す', async () => {
    const { repo, customer } = await withBookingSeeded()
    const undo = await cancelBooking(repo, { customer, booking: { source: 'customer', date: '2026-11-20', setAt: SET_AT }, now: NOW })
    expect((await repo.getCustomer('c2'))?.booking).toBeUndefined()
    await undo()
    expect((await repo.getCustomer('c2'))?.booking?.date).toBe('2026-11-20')
  })
})

describe('会計時の予約を［予約を入れる］で変えたとき（古い予約が戻ってこない）', () => {
  const SET_AT = '2026-11-07T03:00:00.000Z'

  /** 会計時に予約（bookedDate）を入れた客を作る */
  async function seed(bookedDate: string) {
    const repo = createMemoryRepository(PROD_DB)
    const c = createCustomer({ nickname: 'すずらん', steward: 'self', channel: 'own_sns', today: T, now: NOW, id: 'c3' })
    const v = createVisit({ customerId: 'c3', date: '2026-10-01', menuIds: ['cut'], next: { kind: 'booked', date: bookedDate }, source: 'checkout', now: NOW, id: 'v3' })
    await repo.saveRecords({ customers: [c], visits: [v] })
    return { repo, customer: c, visit: v }
  }

  async function effective(repo: ReturnType<typeof createMemoryRepository>, today: string) {
    const all = await repo.loadAll()
    const c = all.customers.find((x) => x.id === 'c3')!
    return { customer: c, booking: effectiveOpenBooking(c, all.visits, today), all }
  }

  async function change(bookedDate: string, to: string) {
    const s = await seed(bookedDate)
    const before = await effective(s.repo, T)
    expect(before.booking?.source).toBe('visit')
    const res = await saveBooking(s.repo, { customer: s.customer, current: before.booking, date: to, today: T, now: SET_AT })
    return { ...s, res }
  }

  it('変えると、来店記録の予約に「予約日を変えた」の印が付く（next は残すのでボードの数え方は変わらない）', async () => {
    const { repo } = await change('2026-11-04', '2026-11-20')
    const v = await repo.getVisit('v3')
    expect(v?.bookingResolution).toBe('replaced')
    expect(v?.next).toEqual({ kind: 'booked', date: '2026-11-04' })
    expect((await effective(repo, T)).booking).toMatchObject({ source: 'customer', date: '2026-11-20' })
  })

  it('変えたあとに［予約を取り消す］: 古い予約（11/4）は来た？に戻ってこない', async () => {
    const { repo } = await change('2026-11-04', '2026-11-20')
    const cur = await effective(repo, T)
    await cancelBooking(repo, { customer: cur.customer, booking: cur.booking!, now: NOW })
    const after = await effective(repo, T)
    expect(after.booking).toBeNull()
  })

  it('変えたあとに［来なかった］: 古い予約（11/25）が有効な予約に戻らない', async () => {
    const { repo } = await change('2026-11-25', '2026-11-20')
    const cur = await effective(repo, '2026-11-21')
    expect(cur.booking).toMatchObject({ source: 'customer', date: '2026-11-20' })
    await resolveNotVisited(repo, { customer: cur.customer, booking: cur.booking!, now: NOW })
    const after = await effective(repo, '2026-11-21')
    expect(after.booking).toBeNull()
    expect((await effective(repo, '2026-11-26')).booking).toBeNull()
  })

  it('変えたのを取り消すと、顧客も来店記録の予約も元に戻る', async () => {
    const { repo, res } = await change('2026-11-04', '2026-11-20')
    await res.undo()
    expect((await repo.getVisit('v3'))?.bookingResolution).toBeUndefined()
    expect((await repo.getCustomer('c3'))?.booking).toBeUndefined()
    expect((await effective(repo, T)).booking).toMatchObject({ source: 'visit', date: '2026-11-04' })
  })

  it('会計時の予約も［予約を取り消す］で取り消せる（「取り消した」の印。取り消しで戻る）', async () => {
    const { repo } = await seed('2026-11-20')
    const cur = await effective(repo, T)
    const undo = await cancelBooking(repo, { customer: cur.customer, booking: cur.booking!, now: NOW })
    expect((await repo.getVisit('v3'))?.bookingResolution).toBe('cancelled')
    expect((await effective(repo, T)).booking).toBeNull()
    await undo()
    expect((await effective(repo, T)).booking).toMatchObject({ source: 'visit', date: '2026-11-20' })
  })
})
