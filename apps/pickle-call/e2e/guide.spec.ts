// ガイド（仕様 §18 の 15）: 確認日と出典リンク。プライバシーの説明と、10の要点の条番号。
import { expect, test } from './fixtures'

test.describe('ガイド', () => {
  test('15. 確認日「2026-11-06」と出典リンク（usapickleball.org・pickleballcanada.org・japanpickleball.org）がある', async ({ page }) => {
    await page.goto('./#/guide')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('数え方とルール')
    await expect(page.getByText('2026-11-06').first()).toBeVisible()
    const hosts = await page
      .locator('main a[href^="https://"]')
      .evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).hostname))
    for (const h of ['usapickleball.org', 'pickleballcanada.org', 'japanpickleball.org']) {
      expect(hosts, `link to ${h}`).toContain(h)
    }
    // 外のリンクは新しいタブで、参照元を渡さない
    const ext = page.locator('main a[target="_blank"]')
    expect(await ext.count()).toBeGreaterThanOrEqual(3)
    for (const rel of await ext.evaluateAll((as) => as.map((a) => a.getAttribute('rel') ?? ''))) {
      expect(rel).toContain('noopener')
    }
    // 注記: 要約であること、審判ではないこと、公式アプリではないこと
    await expect(page.getByText('公式ルールブックで確認してください')).toBeVisible()
    await expect(page.getByText(/審判ではありません/)).toBeVisible()
    // 規則の条番号（2026年版）
    for (const ref of ['6.B.2', '5.B.3', '4.A', '14.A.2', '15.C', '21.B.1', '6.D']) {
      await expect(page.locator('main').getByText(ref, { exact: true }).first()).toBeVisible()
    }
  })

  test('プライバシー: 記録は端末の中だけで、送るのは匿名の回数だけ', async ({ page }) => {
    await page.goto('./#/guide')
    const privacy = page.locator('#privacy')
    await expect(privacy).toContainText('端末の中')
    await expect(page.getByTestId('guide-counter-status')).toBeVisible()
  })

  test('英語のガイドにも確認日と出典がある', async ({ page }) => {
    await page.goto('./?lang=en#/guide')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByText('2026-11-06').first()).toBeVisible()
    await expect(page.locator('main a[href*="usapickleball.org"]')).toHaveCount(1)
  })
})
