// アクセシビリティ（仕様 §18 の 14）: 主要な画面で、axe の serious / critical の違反がゼロ。明るい表示と暗い表示の両方。
import AxeBuilder from '@axe-core/playwright'
import { expect, gotoFresh, seedGame, test } from './fixtures'
import type { Page } from '@playwright/test'

// @axe-core/playwright は自分の playwright-core（版が新しい）の型を使うので、型だけ合わせる（動きは同じ Page）
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]['page']

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const report = bad
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `   - ${n.target.join(' ')} :: ${n.failureSummary ?? ''}`).join('\n')}`)
    .join('\n')
  expect(bad, `${label}\n${report}`).toEqual([])
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe（${scheme}）`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    })

    test('14. ホーム・設定・ガイド・設定画面', async ({ page }) => {
      await seedGame(page, 'AABB', { history: true })
      for (const [route, label] of [
        ['./#/', 'home'],
        ['./#/setup', 'setup'],
        ['./#/guide', 'guide'],
        ['./#/history', 'history'],
        ['./#/settings', 'settings'],
      ] as const) {
        await gotoFresh(page, route)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expectNoSeriousViolations(page, `${label} (${scheme})`)
      }
    })

    test('14. スコア係（進行中・メニュー・スコアを直す）と結果', async ({ page }) => {
      await seedGame(page, 'AABBA')
      await gotoFresh(page, './#/play')
      await expect(page.getByTestId('call')).toHaveText('1-2-2')
      await expectNoSeriousViolations(page, `play (${scheme})`)
      // 折りたたみを両方開いた状態
      await page.getByRole('button', { name: 'なぜこのスコア？' }).click()
      await expectNoSeriousViolations(page, `play panels (${scheme})`)
      await page.getByTestId('menu').click()
      await expect(page.locator('dialog[open]')).toBeVisible()
      await expectNoSeriousViolations(page, `play menu (${scheme})`)
      await page.getByTestId('menu-fix').click()
      await expect(page.getByTestId('fix-preview-call')).toBeVisible()
      await expectNoSeriousViolations(page, `fix modal (${scheme})`)
      await page.keyboard.press('Escape')
      await expect(page.locator('dialog[open]')).toHaveCount(0)

      await seedGame(page, 'AAAAAAAAAAA', { history: true })
      await gotoFresh(page, './#/result')
      await expect(page.getByTestId('result-score')).toHaveText('11-0')
      await expectNoSeriousViolations(page, `result (${scheme})`)
    })

    test('14. 学ぶ（問題・解説・まとめ）', async ({ page }) => {
      await page.goto('./#/learn?scene=receiver')
      await expect(page.getByTestId('learn-question')).toBeVisible()
      await expectNoSeriousViolations(page, `learn question (${scheme})`)
      await page.getByTestId('learn-question').locator('[data-correct="false"]').first().click()
      await expect(page.getByTestId('learn-feedback')).toBeVisible()
      await expectNoSeriousViolations(page, `learn feedback (${scheme})`)
      for (let i = 0; i < 5; i += 1) {
        if (i > 0) await page.getByTestId('learn-question').locator('[data-correct="true"]').click()
        await page.locator('.ln-next').click()
      }
      await expect(page.getByTestId('learn-summary')).toBeVisible()
      await expectNoSeriousViolations(page, `learn summary (${scheme})`)
    })

    test('14. 英語・高コントラストのスコア係', async ({ page }) => {
      await seedGame(page, 'AB')
      await page.evaluate(() => {
        localStorage.setItem('pickle-call:settings', JSON.stringify({ v: 1, data: { lang: 'en', voice: true, rate: 1, highContrast: true } }))
      })
      await gotoFresh(page, './#/play')
      await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
      await expect(page.getByTestId('call')).toHaveText('0-1-1')
      await expectNoSeriousViolations(page, `play en high-contrast (${scheme})`)
      await gotoFresh(page, './#/')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pickle Call')
      await expectNoSeriousViolations(page, `home en high-contrast (${scheme})`)
    })
  })
}

test.describe('フォーカスと題名', () => {
  test('画面を移ると、新しい画面の見出しにフォーカスが移り、タブの題名も画面の名前になる', async ({ page }) => {
    await page.goto('./#/')
    await expect(page).toHaveTitle('ピックルコール')
    await page.getByRole('link', { name: '試合をはじめる' }).click()
    await expect(page).toHaveURL(/#\/setup$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    await expect(page).toHaveTitle('試合の設定 - ピックルコール')
    await page.getByTestId('setup-start').click()
    await expect(page).toHaveURL(/#\/play$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    await expect(page).toHaveTitle('スコア係 - ピックルコール')
    // 最後の1手を戻しても、フォーカスは「1手戻す」に残る（<body> に落ちない）
    await page.getByTestId('rally-A').click()
    await page.getByTestId('undo').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('call')).toHaveText('0-0-2')
    await expect(page.getByTestId('undo')).toBeDisabled()
    await expect(page.getByTestId('undo')).toBeFocused()
  })

  test('選ばれているセグメントのボタンにも、はっきりしたフォーカスの輪が出る', async ({ page }) => {
    await page.goto('./#/setup')
    const doubles = page.locator('main.su').getByRole('button', { name: 'ダブルス', exact: true })
    await expect(doubles).toHaveAttribute('aria-pressed', 'true')
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab')
      if (await doubles.evaluate((el) => el === document.activeElement)) break
    }
    await expect(doubles).toBeFocused()
    const outline = await doubles.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { width: cs.outlineWidth, style: cs.outlineStyle }
    })
    expect(outline).toEqual({ width: '3px', style: 'solid' })
  })

  test('メニューの「試合をやめる」で確認に切り替わると、フォーカスは「続ける」へ移る', async ({ page }) => {
    await seedGame(page, 'AAB')
    await gotoFresh(page, './#/play')
    await page.getByTestId('menu').click()
    await page.getByTestId('menu-quit').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('dialog[open]')).toContainText('試合をやめますか？')
    await expect(page.locator('dialog[open]').getByRole('button', { name: '続ける' })).toBeFocused()
  })

  test('スコア係から開いた設定の「もどる」は、スコア係へ戻る', async ({ page }) => {
    await seedGame(page, 'AAB')
    await gotoFresh(page, './#/play')
    await page.getByTestId('menu').click()
    await page.getByTestId('menu-settings').click()
    await expect(page).toHaveURL(/#\/settings\?from=play$/)
    const back = page.getByRole('link', { name: 'スコア係にもどる' })
    await expect(back).toBeVisible()
    await back.click()
    await expect(page).toHaveURL(/#\/play$/)
    await expect(page.getByTestId('call')).toHaveText('0-2-1')
  })
})

