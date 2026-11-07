// 言語の切り替えと読み上げ（仕様 §18 の 9・10）、URL の ?lang= と ?src= の取り込み。
import { callOf, cancelCalls, expect, rally, spoken, spokenLangs, startGame, stored, test } from './fixtures'

test.describe('言語', () => {
  test('9. 英語に切り替えると UI・html[lang]・読み上げが英語になる', async ({ page }) => {
    await page.goto('./')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ピックルコール')

    await page.getByRole('button', { name: 'English', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pickle Call')
    await expect(page.getByRole('link', { name: 'Start a game' })).toBeVisible()
    await expect(page).toHaveTitle('Pickle Call')

    await page.getByRole('link', { name: 'Start a game' }).click()
    await page.getByTestId('setup-start').click()
    await expect(callOf(page)).toHaveText('0-0-2')
    await expect(page.getByTestId('rally-A')).toContainText('Team A won')
    let s = await spoken(page)
    expect(s[0]).toMatch(/^Zero, zero, two\. Server Team A, from the right\./)
    expect((await spokenLangs(page))[0]).toBe('en-US')

    await rally(page, 'B')
    s = await spoken(page)
    expect(s[s.length - 1]).toMatch(/^Side out\. Zero, zero, one\./)

    // 設定は保存され、再読み込みでも英語のまま
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByTestId('undo')).toHaveAccessibleName('Undo')

    // 日本語に戻す（設定画面から）
    await page.goto('./#/settings')
    await page.getByRole('button', { name: '日本語', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('設定')
  })

  test('9. ?lang=en で開くと英語になり、URL から消える', async ({ page }) => {
    await page.goto('./?lang=en#/guide')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page).toHaveURL(/#\/guide$/)
    expect(page.url()).not.toContain('lang=')
    expect((await stored<{ lang: string }>(page, 'settings'))?.lang).toBe('en')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('How scoring works')
  })

  test('?lang=ja は英語の端末でも日本語にする', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' })
    const page = await context.newPage()
    await page.goto('./')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.goto('./?lang=ja')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    expect(page.url()).not.toContain('lang=')
    await context.close()
  })

  test('?src=abc は取り込んで URL から消す（ハッシュは残す）', async ({ page }) => {
    await page.goto('./?src=abc#/learn')
    await expect(page).toHaveURL(/#\/learn$/)
    expect(page.url()).not.toContain('src=')
    expect(await page.evaluate(() => sessionStorage.getItem('pickle-call:src'))).toBe('abc')
    await expect(page.getByTestId('learn-question')).toBeVisible()
  })

  test('不正な ?src= は保存せずに URL から消す', async ({ page }) => {
    await page.goto('./?src=' + encodeURIComponent('<bad value>'))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(page.url()).not.toContain('src=')
    expect(await page.evaluate(() => sessionStorage.getItem('pickle-call:src'))).toBeNull()
  })
})

test.describe('読み上げ', () => {
  test('10. 読み上げをオフにすると __spoken が増えない', async ({ page }) => {
    await startGame(page)
    await rally(page, 'A')
    const n = (await spoken(page)).length
    expect(n).toBe(2)
    const cancels = await cancelCalls(page)
    await page.getByTestId('voice-toggle').click()
    await expect(page.getByTestId('voice-toggle')).toHaveAttribute('aria-pressed', 'false')
    // 読んでいる途中の文も、その場で止める
    expect(await cancelCalls(page)).toBe(cancels + 1)
    await expect(page.getByTestId('say-again')).toBeDisabled()
    await rally(page, 'A')
    await page.getByTestId('undo').click()
    await rally(page, 'B')
    await expect(callOf(page)).toHaveText('0-1-1')
    expect(await spoken(page)).toHaveLength(n)
    // 表示と aria-live の文は更新され続ける
    await expect(page.getByTestId('call-spoken')).toContainText('サイドアウト。ゼロ、ワン、ワン')

    await page.getByTestId('voice-toggle').click()
    await page.getByTestId('say-again').click()
    const s = await spoken(page)
    expect(s).toHaveLength(n + 1)
    expect(s[n]).toMatch(/^サイドアウト。ゼロ、ワン、ワン/)
  })

  test.describe('speechSynthesis のない端末', () => {
    test.use({ speech: false })

    test('10. 「この端末では読み上げが使えません」と出て、操作は続けられる', async ({ page }) => {
      await page.goto('./#/setup')
      await expect(page.getByText('この端末では読み上げが使えません')).toHaveCount(0)
      await page.getByTestId('setup-start').click()
      await expect(callOf(page)).toHaveText('0-0-2')
      await expect(page.getByText('この端末では読み上げが使えません')).toBeVisible()
      await expect(page.getByTestId('voice-toggle')).toHaveCount(0)
      await rally(page, 'A')
      await rally(page, 'B')
      await expect(callOf(page)).toHaveText('0-1-1')
      await page.getByTestId('undo').click()
      await expect(callOf(page)).toHaveText('1-0-2')
      expect(await spoken(page)).toHaveLength(0)
      // 設定画面でも知らせる
      await page.goto('./#/settings')
      await expect(page.getByText('この端末では読み上げが使えません')).toBeVisible()
    })
  })
})
