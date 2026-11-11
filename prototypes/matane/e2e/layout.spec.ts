/**
 * スマホの画面で、大事な操作が最初の表示の中にあり、下の固定タブに隠れないこと（2.3・4.0・4.3・4.5）。
 * Playwright はクリックの前に自動でスクロールするので、AC-05 などのクリックだけでは確かめられない。ここで位置を測る。
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { homeSection, startSample } from './helpers'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('要素が見えていません')
  return b
}

/** 画面の中にあり、下のタブより上で終わっている */
async function expectAboveTabBar(page: Page, l: Locator) {
  const tab = await box(page.getByRole('navigation', { name: '画面の切り替え' }))
  const b = await box(l)
  expect(b.y).toBeGreaterThanOrEqual(0)
  expect(b.y + b.height).toBeLessThanOrEqual(tab.y)
}

const VIEWPORTS: ReadonlyArray<{ label: string; viewport?: { width: number; height: number } }> = [
  { label: 'Pixel 7' },
  { label: '375x667', viewport: { width: 375, height: 667 } },
]

for (const { label, viewport } of VIEWPORTS) {
  test.describe(label, () => {
    if (viewport) test.use({ viewport })

    test('今日のお客様の［来た］で開いた最初の画面に［6週］と［保存］があり、タブに重ならない（3タップ）', async ({ page }) => {
      await startSample(page)
      await homeSection(page, /今日のお客様/).getByRole('link', { name: 'もみじさん 来た' }).click()
      await expect(page.getByRole('heading', { name: '来店を記録', level: 1 })).toBeVisible()
      // スクロールしていない
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      await expectAboveTabBar(page, page.getByRole('button', { name: '6週' }))
      await expectAboveTabBar(page, page.getByRole('button', { name: '保存' }))
      // ［6週］を押したあとも［保存］が見えている
      await page.getByRole('button', { name: '6週' }).click()
      await expectAboveTabBar(page, page.getByRole('button', { name: '保存' }))
    })

    test('声かけで［コピー］を押すと、「送りましたか？」の［送った］が見え、タブに重ならない', async ({ page }) => {
      await startSample(page)
      await homeSection(page, /声をかけてもよさそうな人/).getByRole('article', { name: 'ゆず' }).getByRole('link', { name: '声をかける' }).click()
      await expect(page.getByRole('heading', { name: 'ゆず', level: 1 })).toBeVisible()
      const copy = page.getByRole('button', { name: 'コピー' })
      // ［コピー］がタブのすぐ上に来るところまでスクロールしてから押す
      await copy.evaluate((el) => {
        const tab = document.querySelector('.tabbar')!.getBoundingClientRect().top
        window.scrollBy(0, el.getBoundingClientRect().bottom - tab + 4)
      })
      await copy.click()
      const sent = page.getByRole('button', { name: '送った', exact: true })
      await expect(sent).toBeVisible()
      await expect.poll(async () => {
        const tab = await box(page.getByRole('navigation', { name: '画面の切り替え' }))
        const b = await box(sent)
        return b.y >= 0 && b.y + b.height <= tab.y
      }).toBe(true)
      await expect(page.getByText('コピーしました')).toBeVisible()
    })
  })
}
