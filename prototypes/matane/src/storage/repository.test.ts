import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ACTIVE_DB_KEY,
  PROD_DB,
  SAMPLE_DB,
  StorageUnavailableError,
  acknowledgeNotice,
  createMemoryRepository,
  deleteDatabase,
  discardSample,
  exportPayload,
  getActiveDbName,
  loadSampleData,
  markBackedUp,
  openRepository,
  openRepositoryOrMemory,
  prepareOnStartup,
  restoreFromPayload,
  setActiveDbName,
  undoRestore,
  wipeDatabase,
  type Repository,
} from './index'
import { buildDemoData, SAMPLE_IDS } from '../data/demo'
import { createCustomer, createVisit, type Visit } from '../domain'

const T = '2026-11-07'
const NOW = '2026-11-07T01:00:00.000Z'

let factory: IDBFactory
const opened: Repository[] = []

async function open(dbName: typeof PROD_DB | typeof SAMPLE_DB = PROD_DB): Promise<Repository> {
  const repo = await openRepository({ dbName, factory })
  opened.push(repo)
  return repo
}

beforeEach(() => {
  factory = new IDBFactory()
  localStorage.clear()
})

afterEach(() => {
  for (const r of opened.splice(0)) r.close()
})

describe('開く・初期化', () => {
  it('起動時の準備でメニュー・文面・カウンタが入り、設定は S0 の［読みました］で作る', async () => {
    const repo = await open()
    const { data } = await prepareOnStartup(repo, { today: T, now: NOW })
    expect(data.menus.map((m) => m.name)[0]).toBe('カット')
    expect(data.menus).toHaveLength(11)
    expect(data.templates.map((t) => t.kind).sort()).toEqual(['koekake', 'matane'])
    expect(data.counters?.firstUsedOn).toBe(T)
    expect(data.settings).toBeNull()
    const s = await acknowledgeNotice(repo, NOW)
    expect(s.notice).toEqual({ version: expect.any(String), ackedAt: NOW })
    expect((await repo.getSettings())?.cooldownDays).toBe(30)
  })

  it('IndexedDB が使えないと StorageUnavailableError。メモリ保存に切り替えられる', async () => {
    await expect(openRepository({ dbName: PROD_DB, factory: null })).rejects.toBeInstanceOf(StorageUnavailableError)
    const { repo, fallback } = await openRepositoryOrMemory({ dbName: SAMPLE_DB, factory: null })
    expect(fallback).toBe(true)
    expect(repo.persistent).toBe(false)
    await loadSampleData(repo, T, NOW)
    const data = await repo.loadAll()
    expect(data.customers).toHaveLength(10)
    expect(data.settings?.stylistName).toBe('サンプル美容師')
  })

  it('開けない IDBFactory（例外を投げる）でもメモリ保存に切り替える', async () => {
    const broken = {
      open() {
        throw new Error('SecurityError')
      },
    } as unknown as IDBFactory
    const { repo, fallback } = await openRepositoryOrMemory({ dbName: PROD_DB, factory: broken })
    expect(fallback).toBe(true)
    expect(repo.kind).toBe('memory')
  })
})

describe('どちらのデータベースを開くか（localStorage matane.activeDb）', () => {
  it('既定は本番用。サンプルに切り替えられる', () => {
    expect(getActiveDbName()).toBe(PROD_DB)
    expect(setActiveDbName(SAMPLE_DB)).toBe(true)
    expect(localStorage.getItem(ACTIVE_DB_KEY)).toBe(SAMPLE_DB)
    expect(getActiveDbName()).toBe(SAMPLE_DB)
  })

  it('値が違う・localStorage が使えないときは本番用', () => {
    localStorage.setItem(ACTIVE_DB_KEY, 'other')
    expect(getActiveDbName()).toBe(PROD_DB)
    expect(getActiveDbName(null)).toBe(PROD_DB)
    const throwing = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(getActiveDbName(throwing)).toBe(PROD_DB)
    expect(setActiveDbName(SAMPLE_DB, throwing)).toBe(false)
  })

  it('本番用とサンプル用は混ざらない', async () => {
    const prod = await open(PROD_DB)
    const sample = await open(SAMPLE_DB)
    await loadSampleData(sample, T, NOW)
    await prod.putCustomer(createCustomer({ nickname: 'さくら', steward: 'self', channel: 'own_sns', today: T, now: NOW }))
    expect((await prod.loadAll()).customers.map((c) => c.nickname)).toEqual(['さくら'])
    expect((await sample.loadAll()).customers).toHaveLength(10)
    await expect(loadSampleData(prod, T, NOW)).rejects.toThrow()
  })

  it('［サンプルを消して自分のお客様で始める］で matane-sample が消え、本番用に切り替わる', async () => {
    setActiveDbName(SAMPLE_DB)
    const sample = await open(SAMPLE_DB)
    await loadSampleData(sample, T, NOW)
    await discardSample(sample, factory)
    expect(getActiveDbName()).toBe(PROD_DB)
    const again = await open(SAMPLE_DB)
    expect((await again.loadAll()).customers).toEqual([])
  })
})

describe('保存の往復（fake-indexeddb）', () => {
  it('サンプルを入れて、閉じて開き直しても件数と内容が同じ', async () => {
    const repo = await open(SAMPLE_DB)
    const demo = buildDemoData(T, NOW)
    await loadSampleData(repo, T, NOW)
    repo.close()
    const again = await open(SAMPLE_DB)
    const data = await again.loadAll()
    const byId = <X extends { id: string }>(xs: X[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id))
    expect(byId(data.customers)).toEqual(byId(demo.customers))
    expect(byId(data.visits)).toEqual(byId(demo.visits))
    expect(byId(data.contacts)).toEqual(byId(demo.contacts))
    expect(data.menus).toEqual(demo.menus)
    expect(data.settings).toEqual(demo.settings)
    expect(data.counters).toEqual(demo.counters)
    expect(await again.visitsOfCustomer(SAMPLE_IDS.yuzu)).toHaveLength(4)
    expect(await again.contactsOfCustomer(SAMPLE_IDS.karin)).toHaveLength(1)
  })

  it('来店記録と顧客の更新を一度に保存できる', async () => {
    const repo = await open()
    const c = createCustomer({ nickname: 'さくら', steward: 'self', channel: 'own_sns', today: T, now: NOW })
    await repo.putCustomer({ ...c, archived: { on: T, reason: 'moved' } })
    const v = createVisit({ customerId: c.id, date: T, menuIds: ['cut'], next: { kind: 'omakase' }, source: 'checkout', now: NOW })
    await repo.saveVisitWithCustomer(v, c)
    const data = await repo.loadAll()
    expect(data.customers[0].archived).toBeUndefined()
    expect(data.visits).toHaveLength(1)
  })
})

describe('削除と取り消し（6.1）', () => {
  async function seeded() {
    const repo = await open(SAMPLE_DB)
    await loadSampleData(repo, T, NOW)
    return repo
  }

  it('顧客の削除は来店・連絡の記録もまとめて隠し、取り消すと戻る', async () => {
    const repo = await seeded()
    const at = await repo.softDeleteCustomer(SAMPLE_IDS.karin, '2026-11-07T02:00:00.000Z')
    let data = await repo.loadAll()
    expect(data.customers.map((c) => c.id)).not.toContain(SAMPLE_IDS.karin)
    expect(data.visits.filter((v) => v.customerId === SAMPLE_IDS.karin)).toHaveLength(0)
    expect(data.contacts.filter((c) => c.customerId === SAMPLE_IDS.karin)).toHaveLength(0)
    const withDeleted = await repo.loadAll({ includeDeleted: true })
    expect(withDeleted.visits.filter((v) => v.customerId === SAMPLE_IDS.karin && v.deletedAt === at)).toHaveLength(4)
    await repo.restoreCustomer(SAMPLE_IDS.karin, at)
    data = await repo.loadAll()
    expect(data.customers.find((c) => c.id === SAMPLE_IDS.karin)?.deletedAt).toBeUndefined()
    expect(data.visits.filter((v) => v.customerId === SAMPLE_IDS.karin)).toHaveLength(4)
    expect(data.contacts.filter((c) => c.customerId === SAMPLE_IDS.karin)).toHaveLength(1)
  })

  it('顧客の取り消しでは、先に別に削除していた来店記録は戻らない', async () => {
    const repo = await seeded()
    const visitId = `${SAMPLE_IDS.karin}-v1`
    await repo.softDeleteVisit(visitId, '2026-11-07T01:59:00.000Z')
    const at = await repo.softDeleteCustomer(SAMPLE_IDS.karin, '2026-11-07T02:00:00.000Z')
    await repo.restoreCustomer(SAMPLE_IDS.karin, at)
    const data = await repo.loadAll()
    expect(data.visits.filter((v) => v.customerId === SAMPLE_IDS.karin).map((v) => v.id)).not.toContain(visitId)
  })

  it('完全削除（purge）は顧客と来店・連絡の記録を消す', async () => {
    const repo = await seeded()
    await repo.softDeleteCustomer(SAMPLE_IDS.karin)
    await repo.purgeCustomer(SAMPLE_IDS.karin)
    const data = await repo.loadAll({ includeDeleted: true })
    expect(data.customers.map((c) => c.id)).not.toContain(SAMPLE_IDS.karin)
    expect(data.visits.filter((v) => v.customerId === SAMPLE_IDS.karin)).toHaveLength(0)
    expect(data.contacts.filter((c) => c.customerId === SAMPLE_IDS.karin)).toHaveLength(0)
  })

  it('来店記録の削除・取り消し・完全削除', async () => {
    const repo = await seeded()
    const id = `${SAMPLE_IDS.wakaba}-v1`
    await repo.softDeleteVisit(id)
    expect((await repo.loadAll()).visits.map((v) => v.id)).not.toContain(id)
    await repo.restoreVisit(id)
    expect((await repo.getVisit(id))?.deletedAt).toBeUndefined()
    await repo.softDeleteVisit(id)
    await repo.purgeVisit(id)
    expect(await repo.getVisit(id)).toBeUndefined()
  })

  it('連絡記録の削除・取り消し', async () => {
    const repo = await seeded()
    const id = `${SAMPLE_IDS.nazuna}-k1`
    await repo.softDeleteContact(id)
    expect((await repo.loadAll()).contacts.map((c) => c.id)).not.toContain(id)
    await repo.restoreContact(id)
    expect((await repo.loadAll()).contacts.map((c) => c.id)).toContain(id)
    await repo.purgeContact(id)
    expect((await repo.loadAll({ includeDeleted: true })).contacts.map((c) => c.id)).not.toContain(id)
  })

  it('アプリが途中で閉じても、次の起動時に削除印つきのデータを完全に消す', async () => {
    const repo = await seeded()
    await repo.softDeleteCustomer(SAMPLE_IDS.yuzu)
    await repo.softDeleteVisit(`${SAMPLE_IDS.wakaba}-v1`)
    repo.close()
    const again = await open(SAMPLE_DB)
    const { purged, data } = await prepareOnStartup(again, { today: T, now: NOW })
    expect(purged).toEqual({ customers: 1, visits: 5, contacts: 0 })
    const all = await again.loadAll({ includeDeleted: true })
    expect(all.customers.map((c) => c.id)).not.toContain(SAMPLE_IDS.yuzu)
    expect(all.visits.some((v) => v.deletedAt)).toBe(false)
    expect(data.customers).toHaveLength(9)
  })

  it('［所属サロンの顧客をまとめて削除］であんずと来店記録が消え、ほかは残る', async () => {
    const repo = await seeded()
    expect(await repo.deleteSalonCustomers()).toBe(1)
    const data = await repo.loadAll({ includeDeleted: true })
    expect(data.customers.map((c) => c.id)).not.toContain(SAMPLE_IDS.anzu)
    expect(data.visits.filter((v) => v.customerId === SAMPLE_IDS.anzu)).toHaveLength(0)
    expect(data.customers).toHaveLength(9)
  })
})

describe('消した顧客を端末に残さない（6.1・7.3）', () => {
  async function seeded() {
    const repo = await open(SAMPLE_DB)
    await loadSampleData(repo, T, NOW)
    return repo
  }

  it('二重に削除しても最初の削除印のままで、取り消せる', async () => {
    const repo = await seeded()
    const at1 = await repo.softDeleteCustomer(SAMPLE_IDS.karin, '2026-11-07T02:00:00.000Z')
    const at2 = await repo.softDeleteCustomer(SAMPLE_IDS.karin, '2026-11-07T02:00:01.000Z')
    expect(at2).toBe(at1)
    await repo.restoreCustomer(SAMPLE_IDS.karin, at2)
    const data = await repo.loadAll()
    expect(data.customers.some((c) => c.id === SAMPLE_IDS.karin)).toBe(true)
    expect(data.visits.filter((v) => v.customerId === SAMPLE_IDS.karin)).toHaveLength(4)
    const vid = `${SAMPLE_IDS.wakaba}-v1`
    const v1 = await repo.softDeleteVisit(vid, '2026-11-07T03:00:00.000Z')
    expect(await repo.softDeleteVisit(vid, '2026-11-07T03:00:05.000Z')).toBe(v1)
  })

  it('顧客を完全に消すと、その顧客を指す下書き（文面・会話メモ・ざっくり登録の行・まとめ記録の行）も消える', async () => {
    const repo = await seeded()
    const anzu = SAMPLE_IDS.anzu
    await repo.putDraft(`koekake:${anzu}`, { text: 'あんずさん、こんにちは。' })
    await repo.putDraft(`visit:new:${anzu}`, { customerId: anzu, talkMemo: '秘密の会話メモ' })
    await repo.putDraft(`visit:fix:${anzu}`, { customerId: anzu, talkMemo: 'x' })
    await repo.putDraft(`visit:edit:${anzu}-v1`, { customerId: anzu, talkMemo: 'y' })
    await repo.putDraft('visit:new', { customerId: anzu, talkMemo: '別の画面の会話メモ' })
    await repo.putDraft('bulk', { channel: 'unknown', rows: [{ key: 'a', nickname: 'あんず', customerId: anzu }, { key: 'b', nickname: 'ゆず2' }] })
    await repo.putDraft(`batch:${T}`, { which: 'today', rows: { [anzu]: { state: 'came' }, [SAMPLE_IDS.yuzu]: { state: 'no' } }, added: [anzu] })
    await repo.putDraft(`koekake:${SAMPLE_IDS.yuzu}`, { text: 'ゆずさん' })
    await repo.putDraft('onboarding', { step: 'name' })

    await repo.deleteSalonCustomers()
    const drafts = await repo.listDrafts()
    const ids = drafts.map((d) => d.formId).sort()
    expect(ids).toEqual(['batch:2026-11-07', 'bulk', `koekake:${SAMPLE_IDS.yuzu}`, 'onboarding'].sort())
    expect(JSON.stringify(drafts)).not.toContain('あんず')
    expect(JSON.stringify(drafts)).not.toContain(anzu)
    const bulk = drafts.find((d) => d.formId === 'bulk')!.data as { rows: { key: string }[] }
    expect(bulk.rows.map((r) => r.key)).toEqual(['b'])
    const batch = drafts.find((d) => d.formId === `batch:${T}`)!.data as { rows: Record<string, unknown>; added: string[] }
    expect(Object.keys(batch.rows)).toEqual([SAMPLE_IDS.yuzu])
    expect(batch.added).toEqual([])
  })

  it('顧客カードの削除の確定（purgeCustomer）でも、その顧客の下書きが消える', async () => {
    const repo = await seeded()
    const id = SAMPLE_IDS.tsubaki
    await repo.putDraft(`visit:new:${id}`, { customerId: id, talkMemo: '秘密の会話メモXYZ' })
    await repo.softDeleteCustomer(id)
    // 取り消しの窓のあいだは残す（取り消せるように）
    expect((await repo.listDrafts()).map((d) => d.formId)).toContain(`visit:new:${id}`)
    await repo.purgeCustomer(id)
    expect(await repo.listDrafts()).toHaveLength(0)
  })

  it('起動時の掃除で、いない顧客を指す下書きと前の日のまとめ記録の下書きを消す', async () => {
    const repo = await seeded()
    await repo.putDraft('koekake:nobody', { text: '消えた人' })
    await repo.putDraft('bulk', { channel: 'unknown', rows: [{ key: 'a', nickname: 'x', customerId: 'nobody' }] })
    await repo.putDraft('batch:2026-11-05', { which: 'today', rows: {}, added: [] })
    await repo.putDraft(`batch:${T}`, { which: 'today', rows: {}, added: [] })
    await repo.putDraft(`koekake:${SAMPLE_IDS.yuzu}`, { text: 'ゆずさん' })
    await repo.softDeleteCustomer(SAMPLE_IDS.karin)
    await repo.putDraft(`koekake:${SAMPLE_IDS.karin}`, { text: 'かりんさん' })
    repo.close()
    const again = await open(SAMPLE_DB)
    await prepareOnStartup(again, { today: T, now: NOW })
    const drafts = await again.listDrafts()
    expect(drafts.map((d) => d.formId).sort()).toEqual([`batch:${T}`, 'bulk', `koekake:${SAMPLE_IDS.yuzu}`].sort())
    expect((drafts.find((d) => d.formId === 'bulk')!.data as { rows: unknown[] }).rows).toEqual([])
  })

  it('所属サロンの顧客をまとめて削除すると、戻す前の状態（RestorePoint）からも消え、［戻す前の状態に戻す］で戻らない', async () => {
    const repo = await seeded()
    const before = await exportPayload(repo, T)
    // バックアップから戻す（今の状態が RestorePoint に残る。あんずも入っている）
    await restoreFromPayload(repo, before, NOW)
    expect((await repo.getRestorePoint())!.payload.customers.some((c) => c.id === SAMPLE_IDS.anzu)).toBe(true)
    expect(await repo.deleteSalonCustomers()).toBe(1)
    const rp = (await repo.getRestorePoint())!
    expect(rp.payload.customers.filter((c) => c.stewardship.steward === 'salon')).toHaveLength(0)
    expect(rp.payload.visits.some((v) => v.customerId === SAMPLE_IDS.anzu)).toBe(false)
    expect(rp.payload.contacts.some((v) => v.customerId === SAMPLE_IDS.anzu)).toBe(false)
    expect(rp.payload.customers).toHaveLength(9)
    expect(await undoRestore(repo)).toBe(true)
    const data = await repo.loadAll()
    expect(data.customers.some((c) => c.stewardship.steward === 'salon')).toBe(false)
    expect(data.customers).toHaveLength(9)
  })

  it('顧客を完全に消すと、戻す前の状態からもその顧客が消える', async () => {
    const repo = await seeded()
    await restoreFromPayload(repo, await exportPayload(repo, T), NOW)
    await repo.purgeCustomer(SAMPLE_IDS.yuzu)
    const rp = (await repo.getRestorePoint())!
    expect(rp.payload.customers.some((c) => c.id === SAMPLE_IDS.yuzu)).toBe(false)
    expect(rp.payload.visits.some((v) => v.customerId === SAMPLE_IDS.yuzu)).toBe(false)
    expect(rp.payload.customers).toHaveLength(9)
  })
})

describe('下書き・カウンタ・設定', () => {
  it('下書きは閉じて開き直しても戻り、保存後に消せる', async () => {
    const repo = await open()
    await repo.putDraft('visit:new', { talkMemo: '途中まで' }, NOW)
    repo.close()
    const again = await open()
    expect(await again.getDraft('visit:new')).toEqual({ formId: 'visit:new', data: { talkMemo: '途中まで' }, updatedAt: NOW })
    expect(await again.listDrafts()).toHaveLength(1)
    await again.deleteDraft('visit:new')
    expect(await again.getDraft('visit:new')).toBeUndefined()
  })

  it('カウンタは同時に増やしても取りこぼさない', async () => {
    const repo = await open()
    await prepareOnStartup(repo, { today: T, now: NOW })
    await Promise.all(Array.from({ length: 5 }, () => repo.incrementCounter('actuallyVisitedFixes')))
    await repo.incrementCounter('koekakeSent', 2)
    const c = await repo.getCounters()
    expect(c).toMatchObject({ actuallyVisitedFixes: 5, koekakeSent: 2, firstUsedOn: T })
  })

  it('カウンタがなければ firstUsedOn を渡したときだけ作る', async () => {
    const repo = await open()
    expect(await repo.incrementCounter('visitsSaved')).toBeNull()
    expect(await repo.incrementCounter('visitsSaved', 1, T)).toMatchObject({ visitsSaved: 1, firstUsedOn: T })
  })

  it('設定の一部を書き換える・バックアップした日時を残す', async () => {
    const repo = await open()
    expect(await repo.updateSettings((s) => s)).toBeNull()
    await acknowledgeNotice(repo, NOW)
    await markBackedUp(repo, '2026-11-07T03:00:00.000Z')
    expect((await repo.getSettings())?.lastBackupAt).toBe('2026-11-07T03:00:00.000Z')
  })
})

describe('バックアップから戻す・戻す前の状態に戻す（RestorePoint）', () => {
  it('戻す前の状態を1回分残し、PIN は端末のものを残す', async () => {
    const sample = await open(SAMPLE_DB)
    await loadSampleData(sample, T, NOW)
    const backup = await exportPayload(sample, T)
    expect(backup.customers).toHaveLength(10)

    const prod = await open(PROD_DB)
    await prepareOnStartup(prod, { today: T, now: NOW })
    const s = await acknowledgeNotice(prod, NOW)
    const lock = { pinHash: 'aGFzaA==', salt: 'c2FsdHNhbHRzYWx0c2FsdA==', iterations: 1000, autoLockMinutes: 5 }
    await prod.putSettings({ ...s, lock })
    await prod.putCustomer(createCustomer({ nickname: 'さくら', steward: 'self', channel: 'own_sns', today: T, now: NOW }))

    await restoreFromPayload(prod, backup, '2026-11-07T04:00:00.000Z')
    let data = await prod.loadAll()
    expect(data.customers).toHaveLength(10)
    expect(data.settings?.lock).toEqual(lock)
    expect(data.settings?.stylistName).toBe('サンプル美容師')
    expect((await prod.getRestorePoint())?.payload.customers.map((c) => c.nickname)).toEqual(['さくら'])
    // 書き出した BackupPayload に PIN は入らない
    expect('lock' in (await exportPayload(prod, T)).settings).toBe(false)

    expect(await undoRestore(prod)).toBe(true)
    data = await prod.loadAll()
    expect(data.customers.map((c) => c.nickname)).toEqual(['さくら'])
    expect(data.settings?.lock).toEqual(lock)
    expect(await prod.getRestorePoint()).toBeNull()
    expect(await undoRestore(prod)).toBe(false)
  })
})

describe('設定がない状態で戻して、戻す前に戻す', () => {
  it('設定のない状態に戻る', async () => {
    const prod = await open(PROD_DB)
    await prepareOnStartup(prod, { today: T, now: NOW })
    await restoreFromPayload(prod, buildDemoData(T, NOW), NOW)
    expect((await prod.getSettings())?.stylistName).toBe('サンプル美容師')
    expect(await undoRestore(prod)).toBe(true)
    expect(await prod.getSettings()).toBeNull()
    expect((await prod.loadAll()).customers).toEqual([])
  })
})

describe('データベースを丸ごと消す', () => {
  it('［すべて消す］のあと開き直すと空', async () => {
    const repo = await open(SAMPLE_DB)
    await loadSampleData(repo, T, NOW)
    await wipeDatabase(repo, factory)
    const again = await open(SAMPLE_DB)
    const data = await again.loadAll()
    expect(data.customers).toEqual([])
    expect(data.settings).toBeNull()
  })

  it('deleteDatabase は開いている接続があっても（versionchange で閉じて）消せる', async () => {
    const repo = await open(SAMPLE_DB)
    await loadSampleData(repo, T, NOW)
    await deleteDatabase(SAMPLE_DB, factory)
    const again = await open(SAMPLE_DB)
    expect((await again.loadAll()).customers).toEqual([])
  })

  it('メモリ保存なら空にする', async () => {
    const repo = createMemoryRepository(SAMPLE_DB)
    await loadSampleData(repo, T, NOW)
    await wipeDatabase(repo)
    expect((await repo.loadAll()).customers).toEqual([])
  })
})

describe('メモリ保存の往復', () => {
  it('IndexedDB と同じように動く（索引・削除・取り消し）', async () => {
    const repo = createMemoryRepository(PROD_DB)
    const c = createCustomer({ nickname: 'さくら', steward: 'self', channel: 'own_sns', today: T, now: NOW })
    const v: Visit = createVisit({ customerId: c.id, date: T, menuIds: ['cut'], next: { kind: 'omakase' }, source: 'checkout', now: NOW })
    await repo.saveRecords({ customers: [c], visits: [v] })
    expect(await repo.visitsOfCustomer(c.id)).toHaveLength(1)
    const at = await repo.softDeleteCustomer(c.id)
    expect((await repo.loadAll()).visits).toHaveLength(0)
    await repo.restoreCustomer(c.id, at)
    expect((await repo.loadAll()).visits).toHaveLength(1)
    // 読み出した値を書き換えても保存されている値は変わらない
    const data = await repo.loadAll()
    data.customers[0].nickname = 'かえ'
    expect((await repo.getCustomer(c.id))?.nickname).toBe('さくら')
  })
})
