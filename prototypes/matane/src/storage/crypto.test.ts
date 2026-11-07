import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import {
  BackupError,
  CSV_HEADER,
  DEFAULT_BACKUP_ITERATIONS,
  DEFAULT_PIN_ITERATIONS,
  backupErrorMessage,
  base64ToBytes,
  bytesToBase64,
  createPinLock,
  csvField,
  decryptBackup,
  encryptBackup,
  hashPin,
  plainCsvExport,
  plainJsonExport,
  serializeBackupFile,
  validatePassphrase,
  validatePin,
  verifyPin,
} from './crypto'
import { exportPayload, loadSampleData, openRepository, restoreFromPayload, wipeDatabase, SAMPLE_DB, PROD_DB } from './index'
import { buildDemoData, SAMPLE_IDS } from '../data/demo'
import type { BackupPayload, EncryptedBackupFile } from '../domain'

const T = '2026-11-07'
const NOW = '2026-11-07T01:00:00.000Z'
const PASS = 'sakura-2026-matane'
/** テストでは反復回数を小さくする（ファイルに記録され、読み込みはファイルの値を使う） */
const FAST = 1000

function demo(): BackupPayload {
  return JSON.parse(JSON.stringify({ ...buildDemoData(T, NOW) })) as BackupPayload
}

describe('暗号化バックアップ（7.4）', () => {
  it('同じパスフレーズで往復すると中身が一致する', async () => {
    const payload = demo()
    const file = await encryptBackup(payload, PASS, { iterations: FAST, now: NOW })
    expect(file).toMatchObject({
      format: 'matane-backup',
      version: 1,
      createdAt: NOW,
      encrypted: true,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: FAST },
      cipher: { name: 'AES-GCM', length: 256 },
    })
    expect(base64ToBytes(file.kdf.salt)).toHaveLength(16)
    expect(base64ToBytes(file.cipher.iv)).toHaveLength(12)
    expect(file.payload).not.toContain('ゆず')
    const text = serializeBackupFile(file)
    expect(text).not.toContain('ゆず')
    const r = await decryptBackup(text, PASS)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.payload).toEqual(payload)
  })

  it('塩と IV は毎回ランダム', async () => {
    const payload = demo()
    const a = await encryptBackup(payload, PASS, { iterations: FAST })
    const b = await encryptBackup(payload, PASS, { iterations: FAST })
    expect(a.kdf.salt).not.toBe(b.kdf.salt)
    expect(a.cipher.iv).not.toBe(b.cipher.iv)
    expect(a.payload).not.toBe(b.payload)
  })

  it('反復回数の既定は 600,000（OWASP の PBKDF2-HMAC-SHA256）でファイルに記録する', async () => {
    expect(DEFAULT_BACKUP_ITERATIONS).toBe(600_000)
    const file = await encryptBackup({ ...demo(), customers: [], visits: [], contacts: [] }, PASS)
    expect(file.kdf.iterations).toBe(600_000)
  })

  it('読み込みはファイルに書かれた反復回数を使う', async () => {
    const file = await encryptBackup(demo(), PASS, { iterations: 1234 })
    const r = await decryptBackup(file, PASS)
    expect(r.ok).toBe(true)
  })

  it('違うパスフレーズ → wrong_passphrase「パスフレーズが違うか、ファイルが壊れています」', async () => {
    const file = await encryptBackup(demo(), PASS, { iterations: FAST })
    const r = await decryptBackup(serializeBackupFile(file), 'wrong-passphrase')
    expect(r).toEqual({ ok: false, error: 'wrong_passphrase', message: 'パスフレーズが違うか、ファイルが壊れています' })
  })

  it('暗号文が書き換わっていると復号できない（wrong_passphrase と同じ文言）', async () => {
    const file = await encryptBackup(demo(), PASS, { iterations: FAST })
    const bytes = base64ToBytes(file.payload)!
    bytes[5] ^= 0xff
    const r = await decryptBackup({ ...file, payload: bytesToBase64(bytes) }, PASS)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toBe('パスフレーズが違うか、ファイルが壊れています')
  })

  it('壊れたファイル → corrupt', async () => {
    const file = await encryptBackup(demo(), PASS, { iterations: FAST })
    const cases: unknown[] = [
      'これはJSONではありません',
      '{"format":"other"}',
      { ...file, kdf: { ...file.kdf, salt: 'AAAA' } },
      { ...file, cipher: { ...file.cipher, iv: '***' } },
      { ...file, payload: 'not base64!' },
      { ...file, kdf: { ...file.kdf, iterations: 0 } },
      { ...file, kdf: { ...file.kdf, iterations: 1e9 } },
      { ...file, encrypted: false },
      { ...file, version: 'x' },
      null,
    ]
    for (const c of cases) {
      const r = await decryptBackup(c, PASS)
      expect(r, JSON.stringify(c)?.slice(0, 60)).toMatchObject({ ok: false, error: 'corrupt' })
    }
  })

  it('復号できても中身の形が違えば corrupt', async () => {
    const bad = { schemaVersion: 1, customers: 'x' } as unknown as BackupPayload
    const file = await encryptBackup(bad, PASS, { iterations: FAST })
    expect(await decryptBackup(file, PASS)).toMatchObject({ ok: false, error: 'corrupt' })
  })

  it('新しい版のファイル → newer_version「新しい版のファイルです。アプリを更新してください」', async () => {
    const file = await encryptBackup(demo(), PASS, { iterations: FAST })
    const newer = { ...file, version: 2 } as unknown as EncryptedBackupFile
    expect(await decryptBackup(serializeBackupFile(newer), PASS)).toEqual({
      ok: false,
      error: 'newer_version',
      message: '新しい版のファイルです。アプリを更新してください',
    })
    // 中身の schemaVersion が新しい
    const inner = await encryptBackup({ ...demo(), schemaVersion: 2 } as unknown as BackupPayload, PASS, { iterations: FAST })
    expect(await decryptBackup(inner, PASS)).toMatchObject({ ok: false, error: 'newer_version' })
  })

  it('パスフレーズは8文字以上', async () => {
    expect(validatePassphrase('1234567')).toBe('パスフレーズは8文字以上にしてください')
    expect(validatePassphrase('12345678')).toBeNull()
    await expect(encryptBackup(demo(), 'short', { iterations: FAST })).rejects.toMatchObject({ code: 'passphrase_too_short' })
    await expect(encryptBackup(demo(), 'short', { iterations: FAST })).rejects.toBeInstanceOf(BackupError)
    expect(backupErrorMessage('crypto_unavailable')).toContain('暗号化を使えません')
  })

  it('AC-13 の計算部分: 書き出し → すべて消す → 同じパスフレーズで読み込むと件数と内容が一致し、PIN は含まない', async () => {
    const factory = new IDBFactory()
    const sample = await openRepository({ dbName: SAMPLE_DB, factory })
    await loadSampleData(sample, T, NOW)
    await sample.updateSettings((s) => ({ ...s, lock: { pinHash: 'eA==', salt: 'eA==', iterations: 1, autoLockMinutes: 5 } }))
    const before = await exportPayload(sample, T)
    expect('lock' in before.settings).toBe(false)
    const file = await encryptBackup(before, PASS, { iterations: FAST })
    await wipeDatabase(sample, factory)

    const prod = await openRepository({ dbName: PROD_DB, factory })
    const r = await decryptBackup(serializeBackupFile(file), PASS)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    await restoreFromPayload(prod, r.payload, NOW)
    const after = await exportPayload(prod, T)
    const sortById = <X extends { id: string }>(xs: X[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id))
    expect(sortById(after.customers)).toEqual(sortById(before.customers))
    expect(sortById(after.visits)).toEqual(sortById(before.visits))
    expect(sortById(after.contacts)).toEqual(sortById(before.contacts))
    expect(after.menus).toEqual(before.menus)
    expect([...after.templates].sort((a, b) => a.kind.localeCompare(b.kind))).toEqual(
      [...before.templates].sort((a, b) => a.kind.localeCompare(b.kind)),
    )
    expect(after.settings).toEqual(before.settings)

    // 違うパスフレーズではデータは変わらない
    const wrong = await decryptBackup(serializeBackupFile(file), 'different-pass')
    expect(wrong.ok).toBe(false)
    expect((await prod.loadAll()).customers).toHaveLength(10)
    prod.close()
  })
})

describe('PIN（4〜8桁、PBKDF2・塩16バイト）', () => {
  it('ハッシュ化と照合', async () => {
    const h = await hashPin('1234', { iterations: FAST })
    expect(base64ToBytes(h.salt)).toHaveLength(16)
    expect(base64ToBytes(h.pinHash)).toHaveLength(32)
    expect(h.iterations).toBe(FAST)
    expect(await verifyPin('1234', h)).toBe(true)
    expect(await verifyPin('1235', h)).toBe(false)
    expect(await verifyPin('12345', h)).toBe(false)
    expect(await verifyPin('abcd', h)).toBe(false)
    // 全角数字でも同じ PIN として扱う
    expect(await verifyPin('１２３４', h)).toBe(true)
  })

  it('同じ PIN でも塩が違えばハッシュが違う', async () => {
    const a = await hashPin('20261107', { iterations: FAST })
    const b = await hashPin('20261107', { iterations: FAST })
    expect(a.salt).not.toBe(b.salt)
    expect(a.pinHash).not.toBe(b.pinHash)
  })

  it('反復回数の既定は 100,000 で、設定に保存する形（PinLock）を作る', async () => {
    expect(DEFAULT_PIN_ITERATIONS).toBe(100_000)
    const lock = await createPinLock('0000')
    expect(lock).toMatchObject({ iterations: 100_000, autoLockMinutes: 5 })
    expect(await verifyPin('0000', lock)).toBe(true)
  })

  it('PIN の形は4〜8桁の数字', async () => {
    expect(validatePin('123')).toBe('PINは4〜8桁の数字にしてください')
    expect(validatePin('123456789')).toBe('PINは4〜8桁の数字にしてください')
    expect(validatePin('12a4')).toBe('PINは4〜8桁の数字にしてください')
    expect(validatePin('1234')).toBeNull()
    expect(validatePin('12345678')).toBeNull()
    await expect(hashPin('12')).rejects.toThrow('PINは4〜8桁の数字にしてください')
  })
})

describe('平文の書き出し（JSON・CSV）', () => {
  it('JSON は所属サロンの顧客（あんず）とその記録を含まない', () => {
    const payload = demo()
    const json = plainJsonExport(payload)
    const parsed = JSON.parse(json) as BackupPayload
    expect(parsed.customers).toHaveLength(9)
    expect(json).not.toContain('あんず')
    expect(json).not.toContain(SAMPLE_IDS.anzu)
    expect(parsed.visits.some((v) => v.customerId === SAMPLE_IDS.anzu)).toBe(false)
    expect('lock' in parsed.settings).toBe(false)
  })

  it('CSV は UTF-8 BOM つき、1行＝1来店、所属サロンの顧客を除く', () => {
    const payload = demo()
    const csv = plainCsvExport(payload)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).trimEnd().split('\r\n')
    expect(lines[0]).toBe(CSV_HEADER.map((h) => `"${h}"`).join(','))
    const nonSalonVisits = payload.visits.filter((v) => v.customerId !== SAMPLE_IDS.anzu)
    expect(lines).toHaveLength(1 + nonSalonVisits.length)
    expect(csv).not.toContain('あんず')
    expect(csv).not.toContain('所属サロン')
    const yuzuLast = lines.find((l) => l.startsWith('"ゆず","2026-08-22"'))
    expect(yuzuLast).toBe('"ゆず","2026-08-22","","カット・白髪染め","おまかせ","","","娘さんの受験（秋）","本人","本人LINE"')
    expect(lines.find((l) => l.startsWith('"ひいらぎ"'))).toBe('"ひいらぎ","2026-07-31","おおよそ","縮毛矯正","","","","","本人","不明"')
    expect(lines.find((l) => l.startsWith('"わかば"'))).toContain('"目安 6週"')
    expect(lines.find((l) => l.startsWith('"すずらん","2026-10-03"'))).toContain('"予約 2026-11-04"')
  })

  it('ダブルクォート・カンマ・改行のエスケープ、式として読まれないよう先頭に \' を付ける', () => {
    expect(csvField('前髪"短め"')).toBe('"前髪""短め"""')
    expect(csvField('a,b\nc')).toBe('"a,b\nc"')
    expect(csvField('=SUM(A1)')).toBe('"\'=SUM(A1)"')
    expect(csvField(8800)).toBe('"8800"')
    expect(csvField(undefined)).toBe('""')
    const payload = demo()
    payload.customers[0] = { ...payload.customers[0], nickname: 'も"み"じ' }
    payload.visits = payload.visits.map((v) =>
      v.customerId === SAMPLE_IDS.momiji ? { ...v, talkMemo: '旅行, 京都\n紅葉', price: 8800 } : v,
    )
    const csv = plainCsvExport(payload)
    expect(csv).toContain('"も""み""じ","2026-07-04","","カット・白髪染め","目安 6週","8800","","旅行, 京都\n紅葉","本人","本人LINE"')
  })
})
