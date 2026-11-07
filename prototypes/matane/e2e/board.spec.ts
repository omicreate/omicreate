/** AC-17（画面部分）: わたしの再来ボードの数字が 8.3 と一致し、円・%を出さず、コピーに呼び名を含めない */
import { expect, test } from '@playwright/test'
import { readClipboard, SAMPLE_NAMES, startSample, tab, visibleText } from './helpers'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('AC-17 ボードの数字が 8.3 と一致し、「円」「%」がなく、［数字をコピー］に呼び名が入らない', async ({ page }) => {
  await startSample(page)
  await tab(page, 'ボード')
  await expect(page.getByRole('heading', { name: 'わたしの再来ボード', level: 1 })).toBeVisible()

  const active = page.getByRole('region', { name: '稼働顧客数' })
  await expect(active).toContainText('10人')
  await expect(active).toContainText('最終来店が1年以内')
  await expect(active).toContainText('先月末 9人')

  const promise = page.getByRole('region', { name: '次回の約束あり' })
  await expect(promise).toContainText('今月 1件中1件')
  await expect(promise).toContainText('目安1')
  await expect(promise).toContainText('先月 1件中1件（予約1）')

  const koekake = page.getByRole('region', { name: '声かけと戻り（直近60日）' })
  await expect(koekake).toContainText('声かけした人 2人 → その後来店 1人')
  await expect(koekake).toContainText('声かけしなかったご無沙汰の人 2人 → その後来店 1人')
  await expect(koekake).toContainText('比べるための事実です。声かけの効果を示すものではありません。人数が少ないうちは偶然の差が大きくなります')
  await expect(page.getByText('比べる相手は業界平均ではなく、先月のあなたです（個人美容師の信頼できる基準値はありません）')).toBeVisible()

  // 内訳（名前は端末内の表示だけ）
  await koekake.getByRole('button', { name: '内訳を見る' }).click()
  await expect(koekake).toContainText('声かけ: かりん')
  await expect(koekake).toContainText('声かけ: なずな')
  await expect(koekake).toContainText('声かけなし: すずらん')
  await expect(koekake).toContainText('声かけなし: つばき')
  await koekake.getByRole('button', { name: '閉じる' }).click()

  // 画面に「円」と「%」の表示がない
  const text = await visibleText(page)
  for (const ng of ['円', '%', '％']) expect(text).not.toContain(ng)

  // ［数字をコピー（名前は含まない）］
  await page.getByRole('button', { name: '数字をコピー（名前は含まない）' }).click()
  await expect(page.getByText('数字をコピーしました')).toBeVisible()
  const copied = await readClipboard(page)
  expect(copied).toContain('稼働顧客数: 10人（先月末 9人）')
  expect(copied).toContain('次回の約束あり: 今月 1件中1件（目安1）／先月 1件中1件（予約1）')
  expect(copied).toContain('声かけした人 2人→来店 1人／しなかったご無沙汰の人 2人→来店 1人')
  expect(copied).toContain('直近28日の来店記録: ')
  expect(copied).toContain('声かけ（累計）: ')
  expect(copied).toContain('見送り（累計）: ')
  expect(copied).toContain('実は来ていた（累計）: ')
  expect(copied).toContain('使い始めた日: ')
  expect(copied).toContain('最後のバックアップ: ')
  for (const name of SAMPLE_NAMES) expect(copied).not.toContain(name)
  for (const ng of ['円', '%', '％']) expect(copied).not.toContain(ng)
})
