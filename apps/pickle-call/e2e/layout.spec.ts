// レイアウト: どの画面でも横スクロールが出ない。スコア係では、コール・コート図・2つのボタンがスクロールなしで画面に収まる。
// 「small-phone」（360×740）と「mobile-chromium」（Pixel 7）の両方で流す。
import { expect, expectInViewport, expectNoHorizontalScroll, gotoFresh, seedGame, test } from './fixtures'
import type { Page } from '@playwright/test'

const LONG_NAMES = { A1: 'ジョナサンアレクサン', A2: 'Maximilian', B1: 'Wolfgang-A', B2: 'たかはしみさき' }

async function setLang(page: Page, lang: 'ja' | 'en') {
  await page.evaluate((l) => {
    const raw = localStorage.getItem('pickle-call:settings')
    const cur = raw ? JSON.parse(raw).data : { voice: true, rate: 1 }
    localStorage.setItem('pickle-call:settings', JSON.stringify({ v: 1, data: { ...cur, lang: l } }))
  }, lang)
}

/** スコア係の主要な要素が、スクロールしないで見えるか */
async function expectPlayFits(page: Page, label: string) {
  await expect(page.getByTestId('call')).toBeVisible()
  expect(await page.evaluate(() => window.scrollY), `${label}: not scrolled`).toBe(0)
  await expectInViewport(page, page.getByTestId('call'), `${label} call`)
  await expectInViewport(page, page.locator('main.play figure.court').first(), `${label} court`)
  await expectInViewport(page, page.getByTestId('rally-A'), `${label} rally-A`)
  await expectInViewport(page, page.getByTestId('rally-B'), `${label} rally-B`)
  // ラリーボタンは高さ96px以上
  for (const t of ['A', 'B']) {
    const box = await page.getByTestId(`rally-${t}`).boundingBox()
    expect(box!.height, `${label} rally-${t} height`).toBeGreaterThanOrEqual(96)
  }
  await expectNoHorizontalScroll(page)
}

test.describe('レイアウト', () => {
  for (const lang of ['ja', 'en'] as const) {
    test(`どの画面でも横スクロールが出ない（${lang}）`, async ({ page }) => {
      await seedGame(page, 'AABBA', { history: true })
      await setLang(page, lang)
      for (const route of ['./#/', './#/setup', './#/play', './#/learn', './#/guide', './#/history', './#/settings']) {
        await gotoFresh(page, route)
        await expect(page.getByRole('heading', { level: 1 })).toBeAttached()
        await expectNoHorizontalScroll(page)
      }
      // 学ぶ: 答えた後とまとめ
      await gotoFresh(page, './#/learn')
      for (let i = 0; i < 5; i += 1) {
        await page.getByTestId('learn-question').locator('[data-correct="false"]').first().click()
        await expectNoHorizontalScroll(page)
        await page.locator('.ln-next').click()
      }
      await expect(page.getByTestId('learn-summary')).toBeVisible()
      await expectNoHorizontalScroll(page)
      // 結果
      await seedGame(page, 'AAAAAAAAAAA', { history: true })
      await gotoFresh(page, './#/result')
      await expect(page.getByTestId('result-score')).toBeVisible()
      await expectNoHorizontalScroll(page)
      // 設定: シングルスとラリー方式の注記
      await gotoFresh(page, './#/setup')
      await page.locator('main.su').getByRole('button', { name: /^(ラリー|Rally)/ }).click()
      await page.locator('main.su').getByRole('button', { name: lang === 'ja' ? 'シングルス' : 'Singles', exact: true }).click()
      await expectNoHorizontalScroll(page)
    })
  }

  test('学ぶ: 12の場面すべてで、問題と解説に横スクロールが出ない（日本語・英語）', async ({ page }) => {
    const ids = [
      'start-call',
      'first-point',
      'server-moves',
      'start-sideout',
      'first-server',
      'receiver',
      'second-server',
      'even-right',
      'singles-odd',
      'rally-call',
      'rally-win',
      'end-change',
    ]
    for (const lang of ['ja', 'en'] as const) {
      for (const id of ids) {
        await gotoFresh(page, `./#/learn?scene=${id}&lang=${lang}`)
        await expect(page.getByTestId('learn-question')).toHaveAttribute('data-scene', id)
        await expectNoHorizontalScroll(page, `${lang} ${id} question`)
        await page.getByTestId('learn-question').locator('[data-correct="false"]').first().click()
        await expect(page.getByTestId('learn-feedback')).toBeVisible()
        await expectNoHorizontalScroll(page, `${lang} ${id} feedback`)
      }
    }
  })

  test('スコア係: コール・コート図・2つのボタンがスクロールなしで収まる（開始・サイドアウト・ゲームポイント・エンドチェンジ）', async ({ page }) => {
    for (const [seq, label] of [
      ['', 'start'],
      ['AAB', 'side out'],
      ['AAAAAA', 'end change'],
      ['AAAAAAAAAA', 'game point'],
      ['AAAAAAAAAAA', 'game over'],
    ] as const) {
      await seedGame(page, seq)
      await gotoFresh(page, './#/play')
      await expectPlayFits(page, label)
    }
  })

  test('スコア係: 長い名前・英語・シングルスでも収まる', async ({ page }) => {
    await seedGame(page, 'AABBA')
    await page.evaluate((names) => {
      const raw = JSON.parse(localStorage.getItem('pickle-call:current')!)
      raw.data.setup.names = names
      localStorage.setItem('pickle-call:current', JSON.stringify(raw))
    }, LONG_NAMES)
    await gotoFresh(page, './#/play')
    await expectPlayFits(page, 'long names ja')
    await setLang(page, 'en')
    await gotoFresh(page, './#/play')
    await expectPlayFits(page, 'long names en')

    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('pickle-call:current')!)
      raw.data.setup.format.kind = 'singles'
      raw.data.setup.names = { A1: 'Maximilian', B1: 'たかはしみさき' }
      localStorage.setItem('pickle-call:current', JSON.stringify(raw))
    })
    await gotoFresh(page, './#/play')
    await expectPlayFits(page, 'singles en')
  })

  test.describe('読み上げのない端末', () => {
    test.use({ speech: false })
    test('スコア係: お知らせが出ても収まる', async ({ page }) => {
      await seedGame(page, 'AB')
      await gotoFresh(page, './#/play')
      await expect(page.getByText('この端末では読み上げが使えません')).toBeVisible()
      await expectPlayFits(page, 'no speech')
    })
  })

  test('スコア係（横向きの電話）: コール・コート図・2つのボタンが収まり、コート図が読める大きさ', async ({ page }) => {
    for (const vp of [
      { width: 844, height: 390 },
      { width: 740, height: 360 },
    ]) {
      await page.setViewportSize(vp)
      await seedGame(page, 'AABBA')
      await gotoFresh(page, './#/play')
      const label = `landscape ${vp.width}x${vp.height}`
      await expectPlayFits(page, label)
      const court = await page.locator('main.play figure.court').first().boundingBox()
      expect(court!.width, `${label} court width`).toBeGreaterThanOrEqual(100)
      expect(court!.height, `${label} court height`).toBeGreaterThanOrEqual(220)
      // コート図はボタンと重ならない
      const a = await page.getByTestId('rally-A').boundingBox()
      expect(court!.x + court!.width, `${label} court left of buttons`).toBeLessThanOrEqual(a!.x + 1)
    }
  })

  test('スコア係: 折りたたみを開いて下へ送っても、ラリーの後もコールは見えたまま', async ({ page }) => {
    await seedGame(page, 'AABB')
    await gotoFresh(page, './#/play')
    await page.getByRole('button', { name: '立ち位置チェック' }).click()
    await expect(page.getByRole('region', { name: '立ち位置チェック' })).toBeInViewport()
    await page.getByTestId('rally-A').click()
    await page.waitForTimeout(350)
    await page.getByTestId('rally-B').click()
    await expect(page.getByTestId('call')).toHaveText('2-2-2')
    await expectInViewport(page, page.getByTestId('call'), 'call after rallies with panel open')
  })

  test('スコア係: 折りたたみを開くと中身が見える位置まで送り、横スクロールは出ない', async ({ page }) => {
    await seedGame(page, 'AABB')
    await gotoFresh(page, './#/play')
    const why = page.getByRole('button', { name: 'なぜこのスコア？' })
    await why.click()
    await expect(why).toHaveAttribute('aria-expanded', 'true')
    const panel = page.getByRole('region', { name: 'なぜこのスコア？' })
    await expect(panel).toBeVisible()
    await expect(panel).toBeInViewport()
    await expectNoHorizontalScroll(page)
  })
})
