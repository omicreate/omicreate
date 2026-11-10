// オフライン（仕様 §18 の 12）と、外への通信がないこと（13）。
// 13 は、テストの中で送信先つきのビルドを作り直せないため、「一連の操作の間に、自分のオリジン以外へ1件も要求が出ない」ことで確かめる。
// （CI のビルドに送信先が入っていても、公開URL以外のホストでは off-site で送らない）
import { callOf, expect, rallies, rally, startGame, test } from './fixtures'
import type { Page } from '@playwright/test'

test.describe('オフライン', () => {
  test('12. Service Worker が有効になった後は、オフラインで再読み込みしてもホームとスコア係が動く', async ({ page, context }) => {
    await page.goto('./')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ピックルコール')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 15_000 })
    // 事前キャッシュに JS と CSS が入っている
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys()
      const mine = keys.filter((k) => k.startsWith('pickle-call-'))
      const urls: string[] = []
      for (const k of mine) for (const r of await (await caches.open(k)).keys()) urls.push(new URL(r.url).pathname)
      return { caches: mine, urls }
    })
    expect(cached.caches).toHaveLength(1)
    expect(cached.urls.some((u) => /\/assets\/.+\.js$/.test(u))).toBe(true)
    expect(cached.urls.some((u) => /\/assets\/.+\.css$/.test(u))).toBe(true)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ピックルコール')
    await page.getByRole('link', { name: '試合をはじめる' }).click()
    await page.getByTestId('setup-start').click()
    await expect(callOf(page)).toHaveText('0-0-2')
    await rallies(page, 'AAB')
    await expect(callOf(page)).toHaveText('0-2-1')

    // 別の画面を直接開いても動く
    await page.goto('./#/learn')
    await expect(page.getByTestId('learn-question')).toBeVisible()
    await context.setOffline(false)
  })
})

/** 一連の操作（開始 → 決着 → 共有 → 学ぶ → ガイド → 設定）。外へ出た要求を集めて返す */
async function fullFlow(page: Page): Promise<string[]> {
  const origin = new URL(test.info().project.use.baseURL!).origin
  const outside: string[] = []
  const onRequest = (url: string) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return
    if (new URL(url).origin !== origin) outside.push(url)
  }
  page.on('request', (r) => onRequest(r.url()))
  page.context().on('request', (r) => onRequest(r.url()))

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await startGame(page)
  for (let i = 0; i < 10; i += 1) await rally(page, 'A')
  await page.getByTestId('rally-A').click()
  await expect(page).toHaveURL(/#\/result$/)
  await page.getByTestId('share').click()
  await expect(page.getByText('コピーしました')).toBeVisible()

  await page.goto('./#/learn')
  for (let i = 0; i < 5; i += 1) {
    await page.getByTestId('learn-question').locator('[data-correct="true"]').click()
    await page.locator('.ln-next').click()
  }
  await expect(page.getByTestId('learn-summary')).toBeVisible()
  await page.goto('./#/guide')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto('./#/settings')
  await expect(page.getByTestId('counter-status')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('counter-status')).toBeVisible()
  return outside
}

test.describe('外への通信', () => {
  test('13. 一連の操作の間、自分のオリジン以外へ1件も要求を出さない', async ({ page }) => {
    const outside = await fullFlow(page)
    expect(outside).toEqual([])
    // この環境では送らない（送信先なし、または公開URL以外）
    await expect(page.getByTestId('counter-status')).toHaveAttribute('data-status', /^off-(config|site)$/)
  })

  test('13. DNT / GPC がオンでも、何も送らない', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1', configurable: true })
      Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true, configurable: true })
    })
    const outside = await fullFlow(page)
    expect(outside).toEqual([])
    expect(await page.evaluate(() => navigator.doNotTrack)).toBe('1')
  })
})

test.describe('ホーム画面に追加したときの見た目', () => {
  test('アプリで選んだ明るさに theme-color を合わせ、英語ではホーム画面の名前も英語にする', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('./#/settings')
    const colors = () => page.locator('meta[name="theme-color"]').evaluateAll((ms) => ms.map((m) => (m as HTMLMetaElement).content))
    expect(await colors()).toEqual(['#fafaf7', '#0f1318'])
    await page.getByRole('button', { name: '暗い', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await colors()).toEqual(['#0f1318', '#0f1318'])
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Pickle Call')
  })
})

