// 学ぶ（仕様 §18 の 11）: 5問に答え、わざと間違えた場面が次の回の1問目に出る。直リンクの場面が1問目に出る。
import { expect, stored, test } from './fixtures'
import type { Page } from '@playwright/test'

const question = (page: Page) => page.getByTestId('learn-question')

/** いまの問題に答える（正解か、わざと不正解）。答えた場面の id を返す */
async function answer(page: Page, correct: boolean): Promise<string> {
  const q = question(page)
  await expect(q).toBeVisible()
  const id = (await q.getAttribute('data-scene'))!
  const choices = q.locator('[data-choice]')
  await expect(choices).toHaveCount(3)
  await q.locator(`[data-correct="${correct ? 'true' : 'false'}"]`).first().click()
  const fb = page.getByTestId('learn-feedback')
  await expect(fb).toBeVisible()
  await expect(fb).toHaveAttribute('data-ok', correct ? 'true' : 'false')
  // 正解の選択肢には、色だけでなく文字の印もつく
  await expect(q.locator('[data-state="correct"]')).toContainText('正解')
  if (!correct) {
    await expect(q.locator('[data-state="wrong"]')).toContainText('あなたの答え')
    await expect(fb).toContainText('正解は')
  }
  return id
}

test.describe('学ぶ', () => {
  test('11. 5問に答えると「5問中4問」、間違えた場面が次の回の1問目に出る', async ({ page }) => {
    await page.goto('./#/learn')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('学ぶ')
    const seen: string[] = []
    let wrongId = ''
    for (let i = 0; i < 5; i += 1) {
      await expect(page.locator('.ln-progress')).toHaveText(`${i + 1} / 5`)
      const wrong = i === 2
      const id = await answer(page, !wrong)
      if (wrong) wrongId = id
      seen.push(id)
      await page.locator('.ln-next').click()
    }
    expect(new Set(seen).size).toBe(5)
    const summary = page.getByTestId('learn-summary')
    await expect(summary).toBeVisible()
    await expect(summary).toContainText('5問中4問')
    const progress = await stored<Record<string, { last: string }>>(page, 'learn')
    expect(progress?.[wrongId]?.last).toBe('ng')

    // もう一回 → 間違えた場面から
    await summary.getByRole('button', { name: 'もう一回' }).click()
    await expect(question(page)).toHaveAttribute('data-scene', wrongId)
    await expect(page.locator('.ln-progress')).toHaveText('1 / 5')

    // 次に開いたとき（再読み込み）も、間違えた場面が1問目
    await page.reload()
    await expect(question(page)).toHaveAttribute('data-scene', wrongId)

    // 正解すると、次の回では先頭から外れる
    await answer(page, true)
    await page.reload()
    await expect(question(page)).not.toHaveAttribute('data-scene', wrongId)
  })

  test('11. #/learn?scene=rally-win で開くと、その場面が1問目になる', async ({ page }) => {
    await page.goto('./#/learn?scene=rally-win')
    await expect(question(page)).toHaveAttribute('data-scene', 'rally-win')
    // ラリー方式の場面では、仮規則の注記を解説に添える
    await answer(page, true)
    await expect(page.getByTestId('learn-feedback')).toContainText('14.A')
  })

  test('知らない場面の id は無視して、ふつうの順で出す', async ({ page }) => {
    await page.goto('./#/learn?scene=nope')
    await expect(question(page)).toHaveAttribute('data-scene', 'start-call')
  })

  test('直リンクに ?lang=en が付いていても、場面は残して言語だけ取り込む', async ({ page }) => {
    await page.goto('./#/learn?scene=end-change&lang=en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(question(page)).toHaveAttribute('data-scene', 'end-change')
    await expect(page).toHaveURL(/#\/learn\?scene=end-change$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Learn')
  })

  test('まとめから「スコア係で使ってみる」で設定画面へ', async ({ page }) => {
    await page.goto('./#/learn')
    for (let i = 0; i < 5; i += 1) {
      await answer(page, true)
      await page.locator('.ln-next').click()
    }
    await expect(page.getByTestId('learn-summary')).toContainText('5問中5問')
    await page.getByTestId('learn-summary').getByRole('link', { name: 'スコア係で使ってみる' }).click()
    await expect(page).toHaveURL(/#\/setup$/)
  })
})
