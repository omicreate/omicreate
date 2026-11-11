/** AC-12: 一度読み込んだあとはオフラインでも、起動・来店記録の保存・声かけ文面のコピー・ボード・暗号化バックアップの書き出しが動く */
import { expect, test } from '@playwright/test'
import { alive, homeSection, openSettings, readClipboard, SAMPLE_DB, startSample, tab, waitForDb, YUZU_TEXT } from './helpers'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('AC-12 オフラインで再読み込みしても、起動・記録・コピー・ボード・暗号化バックアップが動く', async ({ page, context }) => {
  await startSample(page)

  // Service Worker が有効になり、このページを受け持つまで待つ
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)

  await context.setOffline(true)
  await page.reload()
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)

  // 起動（サンプルのホームが出る）
  await expect(page.getByRole('heading', { name: '声をかけてもよさそうな人（4人）' })).toBeVisible()
  await expect(page.getByRole('note').filter({ hasText: 'サンプル表示中' })).toBeVisible()

  // 来店記録の保存
  const todays = homeSection(page, /今日のお客様/)
  await todays.getByRole('link', { name: 'もみじさん 来た' }).click()
  await page.getByRole('button', { name: '6週' }).click()
  await page.getByRole('button', { name: '保存' }).click()
  const sheet = page.getByRole('dialog', { name: 'またねカード' })
  await expect(sheet).toBeVisible()
  // オフラインでは LINE を開けないので、コピーを促す
  await sheet.getByRole('button', { name: 'LINEで送る' }).click()
  await expect(sheet.getByText('LINEを開けませんでした。コピーして送ってください')).toBeVisible()
  await sheet.getByRole('button', { name: '送らない' }).click()
  await expect(todays.getByRole('listitem').filter({ hasText: 'もみじ' })).toContainText('記録済み')
  await waitForDb(page, SAMPLE_DB, (d) => alive(d.visits).some((v) => v.customerId === 'sample-momiji' && v.date === '2026-11-07'))

  // 声かけ文面のコピー
  await homeSection(page, /声をかけてもよさそうな人/).getByRole('article', { name: 'ゆず' }).getByRole('link', { name: '声をかける' }).click()
  await page.getByRole('button', { name: 'コピー' }).click()
  await expect(page.getByText('コピーしました')).toBeVisible()
  expect(await readClipboard(page)).toBe(YUZU_TEXT)

  // ボードの表示
  await tab(page, 'ボード')
  await expect(page.getByRole('region', { name: '稼働顧客数' })).toContainText('10人')
  await expect(page.getByRole('region', { name: '次回の約束あり' })).toContainText('今月 2件中2件')

  // 暗号化バックアップの書き出し
  await openSettings(page, 'データ')
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'バックアップを書き出す（暗号化）' }) })
  await section.getByLabel('パスフレーズ（8文字以上）').fill('offline-pass-1')
  await section.getByLabel('もう一度').fill('offline-pass-1')
  await section.getByLabel('パスフレーズを忘れると戻せないことを確認しました').check()
  const download = page.waitForEvent('download')
  await section.getByRole('button', { name: 'バックアップを書き出す（暗号化）' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('matane-backup-2026-11-07.json')
  await expect(page.getByText('バックアップを書き出しました')).toBeVisible()
  await expect(page.getByText(/^最後のバックアップ 2026-11-07$/)).toBeVisible()

  // ずっとオフラインのまま
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
})
