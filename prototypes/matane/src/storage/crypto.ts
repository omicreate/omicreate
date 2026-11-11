/**
 * 暗号化バックアップ（仕様 7.4、5.1 EncryptedBackupFile）、PIN のハッシュ化と照合、平文の書き出し（JSON・CSV）。
 *
 * - 鍵: パスフレーズ（8文字以上）から PBKDF2-SHA256 で作る。塩16バイト・IV12バイトは毎回ランダム。
 * - 暗号: AES-GCM 256ビット。
 * - 反復回数: OWASP Password Storage Cheat Sheet の PBKDF2-HMAC-SHA256 の値 600,000 を既定にし、
 *   ファイルに記録する。読み込みはファイルに書かれた値を使う（後から上げても古いファイルを読める）。
 * - PIN: 4〜8桁の数字。PBKDF2-SHA256（塩16バイト）。解除が速いよう反復回数は 100,000 を既定にし、設定に保存する。
 *   PIN は覗き見防止で、端末内のデータは暗号化しない。
 */
import {
  bookingResolutionLabel,
  CHANNEL_LABELS,
  compareNames,
  isValidISODate,
  menuNames,
  MESSAGES,
  STEWARD_LABELS,
  validateBackupPayload,
  withoutSalonCustomers,
  DEFAULT_AUTO_LOCK_MINUTES,
  type BackupPayload,
  type EncryptedBackupFile,
  type ISODate,
  type ISODateTime,
  type NextPlan,
  type PinLock,
  type Visit,
} from '../domain'

/** OWASP Password Storage Cheat Sheet（PBKDF2-HMAC-SHA256）の値 */
export const DEFAULT_BACKUP_ITERATIONS = 600_000
/** PIN の解除を速くするための値（設定に保存する） */
export const DEFAULT_PIN_ITERATIONS = 100_000
export const MIN_PASSPHRASE_LENGTH = 8
export const SALT_BYTES = 16
export const IV_BYTES = 12
/** 壊れたファイルで極端な反復回数を回さないための上限 */
export const MAX_ITERATIONS = 10_000_000

export type BackupErrorCode = 'wrong_passphrase' | 'corrupt' | 'newer_version' | 'crypto_unavailable' | 'passphrase_too_short'

export class BackupError extends Error {
  readonly code: BackupErrorCode
  constructor(code: BackupErrorCode) {
    super(backupErrorMessage(code))
    this.name = 'BackupError'
    this.code = code
  }
}

/** エラーの文言。パスフレーズ違いと壊れたファイルは画面では同じ文言にする（7.4） */
export function backupErrorMessage(code: BackupErrorCode): string {
  switch (code) {
    case 'wrong_passphrase':
    case 'corrupt':
      return MESSAGES.wrongPassphraseOrCorrupt
    case 'newer_version':
      return MESSAGES.newerVersion
    case 'crypto_unavailable':
      return MESSAGES.cryptoUnavailable
    case 'passphrase_too_short':
      return MESSAGES.passphraseTooShort
  }
}

export type DecryptResult =
  | { ok: true; payload: BackupPayload; file: EncryptedBackupFile }
  | { ok: false; error: Exclude<BackupErrorCode, 'passphrase_too_short'>; message: string }

/* ========== 基本 ========== */

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) throw new BackupError('crypto_unavailable')
  return s
}

/** Web Crypto が使えるか（安全な接続でしか使えない） */
export function isCryptoAvailable(): boolean {
  return !!globalThis.crypto?.subtle
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(n)
  globalThis.crypto.getRandomValues(out)
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

/** base64 を bytes に。形式が違えば null */
export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> | null {
  if (typeof b64 !== 'string' || b64.length % 4 !== 0 || !BASE64_RE.test(b64)) return null
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function utf8(s: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(s)
  const out = new Uint8Array(encoded.length)
  out.set(encoded)
  return out
}

async function deriveAesKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const s = subtle()
  const base = await s.importKey('raw', utf8(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return s.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/* ========== 暗号化バックアップ ========== */

/** パスフレーズの確かめ（8文字以上）。問題なければ null */
export function validatePassphrase(passphrase: string): string | null {
  return Array.from(passphrase).length >= MIN_PASSPHRASE_LENGTH ? null : MESSAGES.passphraseTooShort
}

/**
 * BackupPayload を暗号化する。
 * @param options.iterations 反復回数（既定 600,000。テストでは小さい値を渡せる）
 */
export async function encryptBackup(
  payload: BackupPayload,
  passphrase: string,
  options: { iterations?: number; now?: ISODateTime } = {},
): Promise<EncryptedBackupFile> {
  if (validatePassphrase(passphrase)) throw new BackupError('passphrase_too_short')
  const iterations = options.iterations ?? DEFAULT_BACKUP_ITERATIONS
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
    throw new RangeError('反復回数が範囲外です')
  }
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = await deriveAesKey(passphrase, salt, iterations)
  const plain = utf8(JSON.stringify(payload))
  const cipherBuf = await subtle().encrypt({ name: 'AES-GCM', iv }, key, plain)
  return {
    format: 'matane-backup',
    version: 1,
    createdAt: options.now ?? new Date().toISOString(),
    encrypted: true,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: bytesToBase64(salt) },
    cipher: { name: 'AES-GCM', length: 256, iv: bytesToBase64(iv) },
    payload: bytesToBase64(new Uint8Array(cipherBuf)),
  }
}

/** ファイルに書く文字列 */
export function serializeBackupFile(file: EncryptedBackupFile): string {
  return JSON.stringify(file, null, 2)
}

/** 書き出すファイル名 */
export function backupFileName(date: ISODate): string {
  return `matane-backup-${date}.json`
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function fail(error: Exclude<BackupErrorCode, 'passphrase_too_short'>): DecryptResult {
  return { ok: false, error, message: backupErrorMessage(error) }
}

/**
 * 暗号化バックアップを読む。エラーを区別して返す:
 *  - 'newer_version': 新しい版のファイル（version が大きい、または中身の schemaVersion が大きい）
 *  - 'corrupt': JSON でない・形が違う・base64 が壊れている・復号できたが中身が壊れている
 *  - 'wrong_passphrase': 復号に失敗（パスフレーズ違い。暗号文の改ざん・破損もここに入る）
 *  - 'crypto_unavailable': Web Crypto が使えない
 * どの場合も今のデータは変えない（呼び出し側は ok のときだけ戻す）。
 */
export async function decryptBackup(input: string | unknown, passphrase: string): Promise<DecryptResult> {
  let obj: unknown = input
  if (typeof input === 'string') {
    try {
      obj = JSON.parse(input.replace(/^﻿/, ''))
    } catch {
      return fail('corrupt')
    }
  }
  if (!isObj(obj) || obj.format !== 'matane-backup') return fail('corrupt')
  if (typeof obj.version !== 'number') return fail('corrupt')
  if (obj.version > 1) return fail('newer_version')
  if (obj.version !== 1 || obj.encrypted !== true) return fail('corrupt')
  const kdf = obj.kdf
  const cipher = obj.cipher
  if (!isObj(kdf) || kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256') return fail('corrupt')
  if (!isObj(cipher) || cipher.name !== 'AES-GCM' || cipher.length !== 256) return fail('corrupt')
  const iterations = kdf.iterations
  if (typeof iterations !== 'number' || !Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
    return fail('corrupt')
  }
  const salt = base64ToBytes(kdf.salt as string)
  const iv = base64ToBytes(cipher.iv as string)
  const data = base64ToBytes(obj.payload as string)
  if (!salt || salt.length !== SALT_BYTES || !iv || iv.length !== IV_BYTES || !data || data.length < 16) {
    return fail('corrupt')
  }
  if (!isCryptoAvailable()) return fail('crypto_unavailable')

  let plainBuf: ArrayBuffer
  try {
    const key = await deriveAesKey(passphrase, salt, iterations)
    plainBuf = await subtle().decrypt({ name: 'AES-GCM', iv }, key, data)
  } catch {
    return fail('wrong_passphrase')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plainBuf))
  } catch {
    return fail('corrupt')
  }
  const check = validateBackupPayload(parsed)
  if (!check.ok) return fail(check.reason)
  return { ok: true, payload: check.payload, file: obj as unknown as EncryptedBackupFile }
}

/* ========== PIN ========== */

const PIN_RE = /^\d{4,8}$/

/** PIN の形（4〜8桁の数字）。問題なければ null */
export function validatePin(pin: string): string | null {
  return PIN_RE.test(pin.normalize('NFKC')) ? null : MESSAGES.pinFormat
}

async function pbkdf2Bits(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const s = subtle()
  const base = await s.importKey('raw', utf8(secret), 'PBKDF2', false, ['deriveBits'])
  const bits = await s.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256)
  return new Uint8Array(bits)
}

export interface PinHash {
  pinHash: string
  salt: string
  iterations: number
}

/** PIN をハッシュにする（塩16バイトは毎回ランダム） */
export async function hashPin(pin: string, options: { iterations?: number } = {}): Promise<PinHash> {
  const err = validatePin(pin)
  if (err) throw new Error(err)
  const iterations = options.iterations ?? DEFAULT_PIN_ITERATIONS
  const salt = randomBytes(SALT_BYTES)
  const hash = await pbkdf2Bits(pin.normalize('NFKC'), salt, iterations)
  return { pinHash: bytesToBase64(hash), salt: bytesToBase64(salt), iterations }
}

/** 設定に保存する PIN の情報を作る */
export async function createPinLock(
  pin: string,
  options: { iterations?: number; autoLockMinutes?: number } = {},
): Promise<PinLock> {
  const h = await hashPin(pin, options)
  return { ...h, autoLockMinutes: options.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES }
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** PIN の照合 */
export async function verifyPin(pin: string, lock: Pick<PinLock, 'pinHash' | 'salt' | 'iterations'>): Promise<boolean> {
  if (validatePin(pin)) return false
  const salt = base64ToBytes(lock.salt)
  const expected = base64ToBytes(lock.pinHash)
  if (!salt || !expected) return false
  const actual = await pbkdf2Bits(pin.normalize('NFKC'), salt, lock.iterations)
  return constantTimeEqual(actual, expected)
}

/* ========== 平文の書き出し（警告を確認してから） ========== */

/** JSON: BackupPayload から所属サロンの顧客とその記録を除いたもの */
export function plainJsonExport(payload: BackupPayload): string {
  return JSON.stringify(withoutSalonCustomers(payload), null, 2)
}

export const CSV_HEADER = [
  '呼び名',
  '来店日',
  'おおよそか',
  'メニュー',
  '次回',
  '金額',
  'レシピメモ',
  '会話メモ',
  '管理者',
  '獲得経路',
] as const

/** CSV の1つの欄（常にダブルクォートで囲み、中の " は "" にする。表計算で式として読まれないよう先頭の = + - @ には ' を付ける） */
export function csvField(value: string | number | undefined | null): string {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

function nextCsv(v: Visit): string {
  const n: NextPlan = v.next
  switch (n.kind) {
    case 'booked':
      return v.bookingResolution ? `予約 ${n.date}（${bookingResolutionLabel(v.bookingResolution)}）` : `予約 ${n.date}`
    case 'agreed':
      return n.unit === 'week' ? `目安 ${n.amount}週` : `目安 ${n.amount}か月`
    case 'omakase':
      return 'おまかせ'
    case 'none':
      return ''
  }
}

/** CSV の「次回」欄に出す、あとから入れた予約（その行の来店日は空） */
export function bookingCsvNext(date: ISODate): string {
  return `予約 ${date}（あとから入れた予約）`
}

/**
 * CSV: 1行＝1来店、所属サロンの顧客を除く、UTF-8 BOM つき、改行は CRLF。
 * あとから入れた予約（customer.booking）は、その客の来店の行のあとに、来店日を空にした1行で出す。
 */
export function plainCsvExport(payload: BackupPayload): string {
  const p = withoutSalonCustomers(payload)
  const byId = new Map(p.customers.filter((c) => !c.deletedAt).map((c) => [c.id, c]))
  type Row = { customerId: string; date: string; visit?: Visit; booking?: ISODate }
  const items: Row[] = [
    ...p.visits.filter((v) => !v.deletedAt && byId.has(v.customerId)).map((v) => ({ customerId: v.customerId, date: v.date, visit: v })),
    ...[...byId.values()]
      .filter((c) => c.booking && isValidISODate(c.booking.date))
      .map((c) => ({ customerId: c.id, date: '\uffff', booking: c.booking!.date })),
  ]
  const rows = items.sort((a, b) => {
    const c = compareNames(byId.get(a.customerId)!, byId.get(b.customerId)!)
    if (c !== 0) return c
    if (a.customerId !== b.customerId) return a.customerId < b.customerId ? -1 : 1
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  })
  const lines = [CSV_HEADER.map(csvField).join(',')]
  for (const row of rows) {
    const c = byId.get(row.customerId)!
    const v = row.visit
    if (!v) {
      lines.push(
        [c.nickname, '', '', '', bookingCsvNext(row.booking!), '', '', '', STEWARD_LABELS[c.stewardship.steward], CHANNEL_LABELS[c.stewardship.channel]]
          .map(csvField)
          .join(','),
      )
      continue
    }
    lines.push(
      [
        c.nickname,
        v.date,
        v.dateApprox ? 'おおよそ' : '',
        menuNames(v.menuIds, p.menus).join('・'),
        nextCsv(v),
        v.price ?? '',
        v.recipe?.text ?? '',
        v.talkMemo ?? '',
        STEWARD_LABELS[c.stewardship.steward],
        CHANNEL_LABELS[c.stewardship.channel],
      ]
        .map(csvField)
        .join(','),
    )
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}

export function plainExportFileNames(date: ISODate): { json: string; csv: string } {
  return { json: `matane-plain-${date}.json`, csv: `matane-plain-${date}.csv` }
}
