/** 設定 → データ: AC-13（暗号化バックアップ）・AC-14（平文の書き出しと所属サロンの顧客の一括削除） */
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import {
  alive,
  dbNames,
  homeSection,
  openCustomer,
  openSettings,
  PROD_DB,
  readDb,
  SAMPLE_DB,
  SAMPLE_NAMES,
  startSample,
  tab,
  waitForDb,
  type DbDump,
} from './helpers'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

const EMPTY_HOME = 'まずはお客様をざっくり登録しましょう。呼び名と、最後に来た月だけで始められます'
const PASSPHRASE = 'matane-pass-2026'
const WRONG = 'matane-pass-0000'
const ANZU = 'sample-anzu'

const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => (a.id < b.id ? -1 : 1))
const byKind = <T extends { kind: string }>(rows: T[]) => [...rows].sort((a, b) => (a.kind < b.kind ? -1 : 1))

/** バックアップで一致すべき中身（設定は PIN を除く） */
function comparable(db: DbDump) {
  const settings = { ...db.settings[0] }
  delete settings.lock
  return {
    customers: byId(db.customers),
    visits: byId(db.visits),
    contacts: byId(db.contacts),
    menus: byId(db.menus),
    templates: byKind(db.templates),
    settings,
  }
}

/** 設定 → データ で暗号化バックアップを書き出し、保存したファイルの場所を返す */
async function exportBackup(page: Page, passphrase: string): Promise<string> {
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'バックアップを書き出す（暗号化）' }) })
  await section.getByLabel('パスフレーズ（8文字以上）').fill(passphrase)
  await section.getByLabel('もう一度').fill(passphrase)
  const button = section.getByRole('button', { name: 'バックアップを書き出す（暗号化）' })
  await expect(button).toBeDisabled()
  await section.getByLabel('パスフレーズを忘れると戻せないことを確認しました').check()
  const download = page.waitForEvent('download')
  await button.click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/\.json$/)
  const path = test.info().outputPath(file.suggestedFilename())
  await file.saveAs(path)
  await expect(page.getByText('バックアップを書き出しました')).toBeVisible()
  return path
}

/** バックアップから戻す欄で、ファイルとパスフレーズを入れて押す */
async function restore(page: Page, path: string, passphrase: string) {
  const form = page.locator('form').filter({ has: page.getByLabel('バックアップのファイルを選ぶ') })
  // 書き出したファイルの中身をそのまま選ぶ（保存先のフォルダ名に依らないよう、中身で渡す）
  await form.getByLabel('バックアップのファイルを選ぶ').setInputFiles({ name: basename(path), mimeType: 'application/json', buffer: await readFile(path) })
  await expect(form.getByText(basename(path))).toBeVisible()
  await form.getByLabel('パスフレーズ', { exact: true }).fill(passphrase)
  await form.getByRole('button', { name: 'バックアップから戻す' }).click()
}

test('AC-13 暗号化バックアップを［すべて消す］のあとに戻すと中身が一致し、違うパスフレーズでは変わらず、戻す前の状態にも戻せる', async ({ page }) => {
  await startSample(page)

  // 連絡記録を1件足す（ゆずに声かけを送った）
  await homeSection(page, /声をかけてもよさそうな人/).getByRole('article', { name: 'ゆず' }).getByRole('link', { name: '声をかける' }).click()
  await page.getByRole('button', { name: 'コピー' }).click()
  await page.getByRole('button', { name: '送った', exact: true }).click()
  await waitForDb(page, SAMPLE_DB, (d) => alive(d.contacts).length === 3)

  // PIN を設定しておく（バックアップに PIN は入らない）
  await openSettings(page, '画面ロック')
  await page.getByLabel('PIN', { exact: true }).fill('2468')
  await page.getByLabel('もう一度').fill('2468')
  await page.getByRole('button', { name: 'PINを設定する' }).click()
  await expect(page.getByText('PINを使っています', { exact: true })).toBeVisible()

  await tab(page, '設定')
  await page.getByRole('link', { name: /^データ/ }).click()
  await expect(page.getByText('まだバックアップしていません')).toBeVisible()
  const before = (await readDb(page, SAMPLE_DB))!
  expect(before.settings[0].lock).toBeTruthy()
  const expected = comparable(before)
  expect(expected.customers).toHaveLength(10)
  expect(expected.contacts).toHaveLength(3)

  const path = await exportBackup(page, PASSPHRASE)
  const file = JSON.parse(await readFile(path, 'utf8'))
  expect(file).toMatchObject({ format: 'matane-backup', version: 1, encrypted: true })
  expect(file.kdf).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256' })
  expect(file.cipher).toMatchObject({ name: 'AES-GCM', length: 256 })
  // 平文の呼び名やメモはファイルに出ない
  for (const s of ['ゆず', 'もみじ', '受験', 'example.com']) expect(JSON.stringify(file)).not.toContain(s)
  await expect(page.getByText(/^最後のバックアップ 2026-11-07$/)).toBeVisible()

  // ［すべて消す］（確認2回）→ サンプルが消え、本番用（まだ空）のホームになる
  await page.getByRole('button', { name: 'すべて消す' }).click()
  await page.getByRole('alertdialog', { name: 'すべて消す' }).getByRole('button', { name: '続ける' }).click()
  await page.getByRole('alertdialog', { name: 'もう一度確かめます' }).getByRole('button', { name: 'すべて消す' }).click()
  await expect(page.getByText(EMPTY_HOME)).toBeVisible()
  await expect(page.getByRole('note').filter({ hasText: 'サンプル表示中' })).toHaveCount(0)
  await expect.poll(() => dbNames(page)).not.toContain(SAMPLE_DB)
  expect(alive((await readDb(page, PROD_DB))?.customers)).toHaveLength(0)

  // 違うパスフレーズ → 「パスフレーズが違うか、ファイルが壊れています」で、データは変わらない
  await openSettings(page, 'データ')
  await restore(page, path, WRONG)
  await expect(page.getByText('パスフレーズが違うか、ファイルが壊れています')).toBeVisible()
  expect(alive((await readDb(page, PROD_DB))?.customers)).toHaveLength(0)

  // 同じパスフレーズ → 中身が一致する（PIN は戻らない）
  await restore(page, path, PASSPHRASE)
  await expect(page.getByText('バックアップから戻しました')).toBeVisible()
  const restored = await waitForDb(page, PROD_DB, (d) => alive(d.customers).length === 10)
  expect(restored.settings[0].lock).toBeUndefined()
  expect(comparable(restored)).toEqual(expected)
  await tab(page, 'ホーム')
  await expect(page.getByRole('heading', { name: '声をかけてもよさそうな人（3人）' })).toBeVisible()
  await expect(page.locator('.lock')).toHaveCount(0)

  // データがある状態で違うパスフレーズ → データは変わらない
  await openSettings(page, 'データ')
  await restore(page, path, WRONG)
  await expect(page.getByText('パスフレーズが違うか、ファイルが壊れています')).toBeVisible()
  expect(comparable((await readDb(page, PROD_DB))!)).toEqual(expected)

  // ［戻す前の状態に戻す］→ 読み込む前（本番用はまだ空）に戻る
  await expect(page.getByText(/^直前の1回分/)).toBeVisible()
  await page.getByRole('button', { name: '戻す前の状態に戻す' }).click()
  await expect(page.getByText('戻す前の状態に戻しました')).toBeVisible()
  const undone = await waitForDb(page, PROD_DB, (d) => alive(d.customers).length === 0)
  expect(alive(undone.visits)).toHaveLength(0)
  expect(alive(undone.contacts)).toHaveLength(0)
  await tab(page, 'ホーム')
  await expect(page.getByText(EMPTY_HOME)).toBeVisible()
})

test('AC-14 平文の書き出しは警告を確かめないと押せず、所属サロンの顧客を含まない。所属サロンの顧客は確認2回でまとめて消せる', async ({ page }) => {
  await startSample(page)
  // あんず（所属サロン）にも連絡の記録を1件作っておく（注意を確かめて送った）
  await openCustomer(page, 'あんず')
  await page.getByRole('link', { name: '声をかける' }).click()
  await page.getByRole('button', { name: '認められているので続ける' }).click()
  await page.getByRole('button', { name: 'コピー' }).click()
  await page.getByRole('button', { name: '送った', exact: true }).click()
  await waitForDb(page, SAMPLE_DB, (d) => alive(d.contacts).some((c) => c.customerId === ANZU))

  await openSettings(page, 'データ')
  const plain = page.locator('section').filter({ has: page.getByRole('heading', { name: '平文で書き出す（JSON／CSV）' }) })
  await expect(plain).toContainText('暗号化されていないファイルです。LINEやメールで送らず、自分だけが見られる場所に保存してください')
  const jsonButton = plain.getByRole('button', { name: 'JSONで書き出す' })
  const csvButton = plain.getByRole('button', { name: 'CSVで書き出す' })
  await expect(jsonButton).toBeDisabled()
  await expect(csvButton).toBeDisabled()
  await plain.getByLabel('暗号化されていないことを確認しました').check()
  await expect(jsonButton).toBeEnabled()

  const jsonDownload = page.waitForEvent('download')
  await jsonButton.click()
  const jsonText = await readFile(await (await jsonDownload).path(), 'utf8')
  const json = JSON.parse(jsonText.replace(/^﻿/, ''))
  expect(json.customers.map((c: { nickname: string }) => c.nickname).sort()).toEqual(SAMPLE_NAMES.filter((n) => n !== 'あんず').sort())
  expect(json.customers.some((c: { id: string }) => c.id === ANZU)).toBe(false)
  expect(json.visits.some((v: { customerId: string }) => v.customerId === ANZU)).toBe(false)
  expect(json.contacts.some((v: { customerId: string }) => v.customerId === ANZU)).toBe(false)
  expect(json.contacts).toHaveLength(2)
  expect(json.visits.length).toBeGreaterThan(0)
  expect(jsonText).not.toContain('あんず')
  expect(jsonText).not.toContain('pinHash')

  const csvDownload = page.waitForEvent('download')
  await csvButton.click()
  const csvBytes = await readFile(await (await csvDownload).path())
  expect([...csvBytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const csv = csvBytes.toString('utf8')
  expect(csv).not.toContain('あんず')
  expect(csv).toContain('ゆず')
  expect(csv).toContain('2026-08-22')
  // 1行＝1来店（見出し＋あんずを除く来店の数）
  const rows = csv.replace(/^﻿/, '').trim().split(/\r?\n/)
  expect(rows.length - 1).toBe(json.visits.length)

  // ［所属サロンの顧客をまとめて削除］（確認2回）
  const before = (await readDb(page, SAMPLE_DB))!
  expect(before.visits.some((v) => v.customerId === ANZU)).toBe(true)
  expect(before.contacts.some((v) => v.customerId === ANZU)).toBe(true)
  await page.getByRole('button', { name: '所属サロンの顧客をまとめて削除' }).click()
  const first = page.getByRole('alertdialog', { name: '所属サロンの顧客をまとめて削除' })
  await expect(first).toContainText('所属サロンが管理者の顧客 1人と、その来店・連絡の記録を消します')
  await first.getByRole('button', { name: '続ける' }).click()
  const second = page.getByRole('alertdialog', { name: 'もう一度確かめます' })
  await second.getByRole('button', { name: '消す', exact: true }).click()
  await expect(page.getByText('所属サロンの顧客 1人を削除しました')).toBeVisible()

  const after = await waitForDb(page, SAMPLE_DB, (d) => !d.customers.some((c) => c.id === ANZU))
  expect(after.visits.some((v) => v.customerId === ANZU)).toBe(false)
  expect(after.contacts.some((v) => v.customerId === ANZU)).toBe(false)
  expect(alive(after.customers)).toHaveLength(9)
  expect(after.visits).toHaveLength(before.visits.filter((v) => v.customerId !== ANZU).length)
  expect(after.contacts).toHaveLength(before.contacts.filter((c) => c.customerId !== ANZU).length)
  expect(after.contacts).toHaveLength(2)
  await expect(page.getByRole('button', { name: '所属サロンの顧客をまとめて削除' })).toBeDisabled()

  await tab(page, 'お客様')
  const list = page.getByRole('list', { name: 'お客様の一覧' })
  await expect(list.getByRole('link')).toHaveCount(9)
  await expect(list).not.toContainText('あんず')
  for (const name of SAMPLE_NAMES.filter((n) => n !== 'あんず')) await expect(list).toContainText(name)
})
