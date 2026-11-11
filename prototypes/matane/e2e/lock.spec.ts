/** AC-18: 画面ロック（PIN を設定したときだけ） */
import { expect, test, type Page } from '@playwright/test'
import { alive, openSettings, PROD_DB, readDb, SAMPLE_DB, setHidden, startSample } from './helpers'

const PIN = '2468'
const MINUTE = 60_000

function lockScreen(page: Page) {
  return page.getByRole('dialog', { name: 'またね帳' })
}

/** ロックしていないこと（時計を進めた直後の描き直しを待ってから確かめる） */
async function expectNotLocked(page: Page) {
  await page.waitForTimeout(250)
  await expect(lockScreen(page)).toHaveCount(0)
}

async function unlock(page: Page, pin = PIN) {
  const lock = lockScreen(page)
  await lock.getByLabel('PIN', { exact: true }).fill(pin)
  await lock.getByRole('button', { name: '解除' }).click()
}

test('AC-18 PIN を設定すると、5分操作しないか1分以上離れて戻るとロックし、5回の間違いで30秒待ち、［PINを忘れた］は確認2回で全データを消す', async ({ page }) => {
  await startSample(page)
  // PIN を設定する前にしばらく使っていた（設定した直後にロックしないこと）
  await page.clock.fastForward(6 * MINUTE)

  await openSettings(page, '画面ロック')
  await expect(page.getByText('これは覗き見防止で、データの暗号化ではありません')).toBeVisible()
  await page.getByLabel('PIN', { exact: true }).fill(PIN)
  await page.getByLabel('もう一度').fill(PIN)
  await page.getByRole('button', { name: 'PINを設定する' }).click()
  await expect(page.getByText('PINを使っています', { exact: true })).toBeVisible()
  await page.clock.fastForward(10_000)
  await expectNotLocked(page)

  // 5分操作しない → ロック（4分50秒ではまだ）
  await page.clock.fastForward(4 * MINUTE + 40_000)
  await expectNotLocked(page)
  await page.clock.fastForward(15_000)
  await expect(lockScreen(page)).toBeVisible()
  await expect(lockScreen(page)).toContainText('これは覗き見防止で、データの暗号化ではありません')
  // 後ろの画面は操作できない
  await expect(page.locator('.app')).toHaveAttribute('inert', '')
  await unlock(page)
  await expect(lockScreen(page)).toHaveCount(0)

  // アプリを離れて30秒で戻る → ロックしない。1分以上たって戻る → ロック
  await setHidden(page, true)
  await page.clock.fastForward(30_000)
  await setHidden(page, false)
  await expectNotLocked(page)
  await setHidden(page, true)
  await page.clock.fastForward(61_000)
  await setHidden(page, false)
  await expect(lockScreen(page)).toBeVisible()

  // 5回続けて間違えると30秒入力できない
  for (let i = 1; i <= 4; i++) {
    await unlock(page, '1111')
    await expect(lockScreen(page).getByText('PINが違います')).toBeVisible()
    await expect(lockScreen(page).getByLabel('PIN', { exact: true })).toHaveValue('')
  }
  await unlock(page, '1111')
  await expect(lockScreen(page).getByText('間違いが5回続いたため、30秒入力できません')).toBeVisible()
  await expect(lockScreen(page).getByLabel('PIN', { exact: true })).toBeDisabled()
  await expect(lockScreen(page).getByRole('button', { name: '解除' })).toBeDisabled()
  await page.clock.fastForward(20_000)
  await expect(lockScreen(page).getByText(/^間違いが5回続いたため、\d+秒入力できません$/)).toBeVisible()
  await expect(lockScreen(page).getByLabel('PIN', { exact: true })).toBeDisabled()
  await page.clock.fastForward(11_000)
  await expect(lockScreen(page).getByLabel('PIN', { exact: true })).toBeEnabled()
  await unlock(page)
  await expect(lockScreen(page)).toHaveCount(0)

  // 開き直すとロックしている
  await page.reload()
  await expect(lockScreen(page)).toBeVisible()

  // ［PINを忘れた］→ 確認2回 → 全データを消す
  await lockScreen(page).getByRole('button', { name: 'PINを忘れた' }).click()
  const first = page.getByRole('alertdialog', { name: 'PINを忘れた' })
  await expect(first).toContainText('PINを解除するには、この端末のデータをすべて消す必要があります。バックアップがあれば、消したあとに戻せます')
  await first.getByRole('button', { name: '続ける' }).click()
  const second = page.getByRole('alertdialog', { name: 'もう一度確かめます' })
  await second.getByRole('button', { name: 'すべて消す' }).click()

  await expect(lockScreen(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'サンプルで試す' })).toBeVisible()
  await expect(page.getByRole('note').filter({ hasText: 'サンプル表示中' })).toHaveCount(0)
  for (const name of [SAMPLE_DB, PROD_DB]) {
    const db = await readDb(page, name)
    expect(alive(db?.customers)).toHaveLength(0)
    expect(alive(db?.visits)).toHaveLength(0)
    expect(db?.settings ?? []).toHaveLength(0)
  }
})
