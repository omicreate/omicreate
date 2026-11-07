/** 画面の操作から呼ぶ保存の手順（state/actions）の確かめ。メモリ保存で動かす */
import { describe, expect, it } from 'vitest'
import { createMemoryRepository, PROD_DB } from '../storage'
import { archiveCustomer, createCustomer, createVisit } from '../domain'
import { saveVisit, skipKoekake } from './actions'

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
