/** 本番用で始める・ざっくり登録・サンプルとの切り替え: AC-11・AC-19 */
import { expect, test, type Page } from '@playwright/test'
import {
  alive,
  candidateNames,
  dbNames,
  homeSection,
  openApp,
  openSettings,
  PROD_DB,
  readDb,
  SAMPLE_DB,
  startSample,
  tab,
  waitForDb,
} from './helpers'

const EMPTY_HOME = 'まずはお客様をざっくり登録しましょう。呼び名と、最後に来た月だけで始められます'

/** ざっくり登録の1行目を入れて、保存されるまで待つ */
async function fillBulkRow(page: Page, index: number, nickname: string, lastVisit: string, menu: string) {
  const row = page.getByRole('list', { name: '登録する行' }).getByRole('listitem').nth(index)
  await row.getByLabel('呼び名').fill(nickname)
  await row.getByLabel(/^最終来店/).fill(lastVisit)
  await row.getByRole('button', { name: menu, exact: true }).click()
  await expect(row.getByText('保存しました')).toBeVisible()
  return row
}

test('AC-11 空の本番用データでざっくり登録した「ひいらぎ／7月／縮毛矯正」が、おおよその最終来店として候補に出る', async ({ page }) => {
  await openApp(page)
  await page.getByLabel('読みました').check()
  await page.getByRole('button', { name: '自分のお客様で始める' }).click()

  // 自分の名前 → 予約リンク → 使うメニュー → ざっくり登録
  await expect(page.getByRole('heading', { name: '自分の名前', level: 1 })).toBeVisible()
  await page.getByLabel('名前（任意）').fill('テスト美容師')
  await page.getByRole('button', { name: '次へ' }).click()
  await expect(page.getByRole('heading', { name: '予約リンク', level: 1 })).toBeVisible()
  await page.getByLabel('自分用').fill('http://example.com/booking')
  await page.getByRole('button', { name: '次へ' }).click()
  await expect(page.getByText('https:// で始まるURLを入れてください')).toBeVisible()
  await page.getByLabel('自分用').fill('https://example.com/booking')
  await page.getByRole('button', { name: '次へ' }).click()
  await expect(page.getByRole('heading', { name: '使うメニュー', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: '縮毛矯正' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'ざっくり登録へ' }).click()
  await expect(page.getByRole('heading', { name: 'ざっくり登録', level: 1 })).toBeVisible()

  // 共通設定: 管理者は必須（選ぶまでは保存しない）
  const common = page.locator('section').filter({ has: page.getByRole('heading', { name: 'この登録の共通設定' }) })
  const firstRow = page.getByRole('list', { name: '登録する行' }).getByRole('listitem').first()
  await firstRow.getByLabel('呼び名').fill('ひいらぎ')
  await expect(page.getByText('データの管理者を選んでください')).toBeVisible()
  await common.getByRole('radio', { name: '本人' }).click()
  await fillBulkRow(page, 0, 'ひいらぎ', '7月', '縮毛矯正')
  await expect(firstRow.getByText('2026-07-31（おおよそ）')).toBeVisible()

  const db = await waitForDb(page, PROD_DB, (d) => alive(d.visits).length === 1)
  const customer = alive(db.customers).find((c) => c.nickname === 'ひいらぎ')!
  expect(customer.stewardship).toMatchObject({ steward: 'self', channel: 'unknown' })
  expect(customer.contact.permission).toBe('unknown')
  const visit = alive(db.visits)[0]
  expect(visit).toMatchObject({ customerId: customer.id, date: '2026-07-31', dateApprox: 'month', source: 'bulk', menuIds: ['straight'] })

  await page.getByRole('button', { name: '1人を登録してホームへ' }).click()
  await expect(page.getByRole('heading', { name: '声をかけてもよさそうな人（1人）' })).toBeVisible()
  expect(await candidateNames(page)).toEqual(['ひいらぎ'])
  const card = homeSection(page, /声をかけてもよさそうな人/).getByRole('article', { name: 'ひいらぎ' })
  await expect(card).toContainText('最終来店はおおよそ')
  await expect(card).toContainText('連絡OKは未確認')
  await expect(card).toContainText('目安 約90日（縮毛矯正）→ 99日')
  // 本番用なのでサンプルの帯は出ない
  await expect(page.getByRole('note').filter({ hasText: 'サンプル表示中' })).toHaveCount(0)

  // 共通設定で獲得経路「サロン媒体」を選ぶと、管理者の初期値が「所属サロン」になる
  await tab(page, 'お客様')
  await page.getByRole('link', { name: 'ざっくり登録' }).click()
  await expect(page.getByRole('heading', { name: 'ざっくり登録', level: 1 })).toBeVisible()
  await expect(common.getByRole('radio', { name: '所属サロン' })).toHaveAttribute('aria-checked', 'false')
  await common.getByLabel('獲得経路').selectOption({ label: 'サロン媒体' })
  await expect(common.getByRole('radio', { name: '所属サロン' })).toHaveAttribute('aria-checked', 'true')
  await expect(common.getByRole('radio', { name: '本人' })).toHaveAttribute('aria-checked', 'false')
  // 変えられる
  await common.getByRole('radio', { name: '本人' }).click()
  await expect(common.getByRole('radio', { name: '本人' })).toHaveAttribute('aria-checked', 'true')
  // 経路「サロンからの引き継ぎ」でも所属サロンになる
  await common.getByLabel('獲得経路').selectOption({ label: 'サロンからの引き継ぎ' })
  await expect(common.getByRole('radio', { name: '所属サロン' })).toHaveAttribute('aria-checked', 'true')
})

test('AC-19 ［サンプルを消して自分のお客様で始める］でサンプル用データベースが消え、本番用のデータはサンプルに出ない', async ({ page }) => {
  await startSample(page)
  expect(await dbNames(page)).toContain(SAMPLE_DB)

  await openSettings(page, 'サンプル')
  await page.getByRole('button', { name: 'サンプルを消して自分のお客様で始める' }).click()
  await expect(page.getByText(EMPTY_HOME)).toBeVisible()
  await expect(page.getByRole('link', { name: 'ざっくり登録' })).toBeVisible()
  await expect(page.getByRole('note').filter({ hasText: 'サンプル表示中' })).toHaveCount(0)
  await expect.poll(() => dbNames(page)).not.toContain(SAMPLE_DB)
  expect(await page.evaluate(() => localStorage.getItem('matane.activeDb'))).toBe(PROD_DB)

  // 本番用にお客様を入れる
  await page.getByRole('link', { name: 'ざっくり登録' }).click()
  const common = page.locator('section').filter({ has: page.getByRole('heading', { name: 'この登録の共通設定' }) })
  await common.getByRole('radio', { name: '本人' }).click()
  await fillBulkRow(page, 0, 'さくら', '9月', 'カット')
  await page.getByRole('button', { name: '1人を登録してホームへ' }).click()
  await expect(page.getByText(EMPTY_HOME)).toHaveCount(0)
  await tab(page, 'お客様')
  await expect(page.getByRole('list', { name: 'お客様の一覧' })).toContainText('さくら')

  // サンプルに切り替えると、本番用の「さくら」は出ない
  await openSettings(page, 'サンプル')
  await page.getByRole('button', { name: 'サンプルで試す' }).click()
  await expect(page.getByRole('note').filter({ hasText: 'サンプル表示中' })).toBeVisible()
  await tab(page, 'お客様')
  const list = page.getByRole('list', { name: 'お客様の一覧' })
  await expect(list).toContainText('ゆず')
  await expect(list.getByRole('link')).toHaveCount(10)
  await expect(list).not.toContainText('さくら')
  const sample = (await readDb(page, SAMPLE_DB))!
  expect(alive(sample.customers).map((c) => c.nickname)).not.toContain('さくら')
  const prod = (await readDb(page, PROD_DB))!
  expect(alive(prod.customers).map((c) => c.nickname)).toEqual(['さくら'])
})
