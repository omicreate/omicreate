/** AC-01: ホームが 8.3 のとおりに出る */
import { expect, test } from '@playwright/test'
import { candidateNames, homeSection, startSample } from './helpers'

test('AC-01 ホームに今日のお客様・来た？・声かけ候補の順・出していない人の要約が 8.3 のとおりに出る', async ({ page }) => {
  await startSample(page)

  // 今日のお客様＝もみじ（［来た］ボタンつき）
  const todays = homeSection(page, /今日のお客様/)
  await expect(todays.getByRole('listitem')).toHaveCount(1)
  await expect(todays.getByRole('listitem').first()).toContainText('もみじ')
  await expect(todays.getByRole('link', { name: 'もみじさん 来た' })).toBeVisible()

  // 来た？の確認＝すずらん（予約 11/4）
  const confirms = homeSection(page, /来た？の確認/)
  await expect(confirms).toContainText('すずらん')
  await expect(confirms).toContainText('予約 11月4日（水）')
  await expect(confirms.getByRole('link', { name: '来た', exact: true })).toBeVisible()
  await expect(confirms.getByRole('link', { name: '別の日に来た' })).toBeVisible()
  await expect(confirms.getByRole('button', { name: '来なかった' })).toBeVisible()

  // 声をかけてもよさそうな人＝つばき→ゆず→ひいらぎ→かりん の4人
  await expect(page.getByRole('heading', { name: '声をかけてもよさそうな人（4人）' })).toBeVisible()
  expect(await candidateNames(page)).toEqual(['つばき', 'ゆず', 'ひいらぎ', 'かりん'])
  const cands = homeSection(page, /声をかけてもよさそうな人/)
  for (const name of ['あんず', 'こむぎ', 'なずな', 'わかば', 'もみじ', 'すずらん']) {
    await expect(cands.getByRole('article', { name })).toHaveCount(0)
  }

  // 区分バッジとラベル
  const tsubaki = cands.getByRole('article', { name: 'つばき' })
  await expect(tsubaki).toContainText('離れたかも')
  await expect(tsubaki).toContainText('連絡OKは未確認')
  const yuzu = cands.getByRole('article', { name: 'ゆず' })
  await expect(yuzu).toContainText('ご無沙汰')
  await expect(yuzu).toContainText('いつもは約8週ごと → 今回は11週')
  await expect(yuzu).toContainText('前回 カットと白髪染め')
  await expect(yuzu).not.toContainText('連絡OKは未確認')
  const hiiragi = cands.getByRole('article', { name: 'ひいらぎ' })
  await expect(hiiragi).toContainText('ご無沙汰')
  await expect(hiiragi).toContainText('最終来店はおおよそ')
  await expect(hiiragi).toContainText('連絡OKは未確認')
  await expect(hiiragi).toContainText('目安 約90日（縮毛矯正）→ 99日')
  const karin = cands.getByRole('article', { name: 'かりん' })
  await expect(karin).toContainText('そろそろ')
  for (const name of ['つばき', 'ゆず', 'ひいらぎ', 'かりん']) {
    await expect(cands.getByRole('article', { name }).getByRole('link', { name: '声をかける' })).toBeVisible()
  }

  // 出していない人の要約（文言が 8.3 と一致）
  await expect(page.getByText('所属サロンの顧客 1人・連絡しない 1人・声をかけてから30日以内 1人は出していません', { exact: true })).toBeVisible()

  // 記録停止の表示は出ない（最後の記録は 11-02）。「失客」という語は画面に出さない
  await expect(page.getByText(/記録が止まっています/)).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('失客')
  await expect(page.getByRole('link', { name: '来店を記録' })).toBeVisible()
  await expect(page.getByRole('link', { name: /閉店後のまとめ記録/ })).toBeVisible()
})
