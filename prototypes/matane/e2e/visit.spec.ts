/** 来店記録（S2）とまたねカード: AC-05・AC-06・AC-07・AC-16 */
import { expect, test } from '@playwright/test'
import { alive, homeSection, openCustomer, readDb, SAMPLE_DB, startSample, waitForDb } from './helpers'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

const MOMIJI = 'sample-momiji'
const YUZU = 'sample-yuzu'

test('AC-05 もみじの［来た］→［6週］→［保存］の3回で記録でき、またねカードに「12月中旬ごろ」と予約リンクが入る', async ({ page }) => {
  await startSample(page)
  const todays = homeSection(page, /今日のお客様/)

  // 1回目〜3回目のクリック
  await todays.getByRole('link', { name: 'もみじさん 来た' }).click()
  await expect(page.getByRole('heading', { name: '来店を記録', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: '6週' }).click()
  await page.getByRole('button', { name: '保存' }).click()

  const sheet = page.getByRole('dialog', { name: 'またねカード' })
  await expect(sheet).toBeVisible()
  const text = await sheet.getByRole('textbox').inputValue()
  expect(text).toBe(
    [
      'もみじさん、今日はありがとうございました。',
      '今日のメニュー：カットと白髪染め',
      '次回の目安：12月中旬ごろ',
      'ご予約はこちらからどうぞ。 https://example.com/booking',
      'サンプル美容師',
    ].join('\n'),
  )

  const db = await waitForDb(page, SAMPLE_DB, (d) => alive(d.visits).some((v) => v.customerId === MOMIJI && v.date === '2026-11-07'))
  const v = alive(db.visits).find((x) => x.customerId === MOMIJI && x.date === '2026-11-07')!
  expect([...v.menuIds].sort()).toEqual(['cut', 'gray'])
  expect(v.next).toEqual({ kind: 'agreed', amount: 6, unit: 'week' })
  expect(v.source).toBe('checkout')

  await sheet.getByRole('button', { name: '送らない' }).click()
  await expect(todays.getByRole('listitem').filter({ hasText: 'もみじ' })).toContainText('記録済み')
  await expect(todays.getByRole('link', { name: 'もみじさん 来た' })).toHaveCount(0)
})

test('AC-06 会話メモの入力途中は再読み込みで戻り、［保存］のあとは下書きが残らない', async ({ page }) => {
  await startSample(page)
  await homeSection(page, /今日のお客様/).getByRole('link', { name: 'もみじさん 来た' }).click()
  await expect(page.getByRole('heading', { name: '来店を記録', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: /くわしく/ }).click()
  await page.getByLabel('会話メモ').fill('年末は帰省の予定')

  // 0.3秒後に下書きとして保存される
  await waitForDb(page, SAMPLE_DB, (d) => d.drafts.some((x) => JSON.stringify(x.data).includes('年末は帰省の予定')), '下書き')
  await page.reload()
  await expect(page.getByText('入力途中の内容を戻しました')).toBeVisible()
  await expect(page.getByLabel('会話メモ')).toHaveValue('年末は帰省の予定')

  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('dialog', { name: 'またねカード' })).toBeVisible()
  const db = await waitForDb(page, SAMPLE_DB, (d) => d.drafts.length === 0, '下書きが消える')
  expect(alive(db.visits).find((v) => v.customerId === MOMIJI && v.date === '2026-11-07')?.talkMemo).toBe('年末は帰省の予定')
  await page.getByRole('dialog', { name: 'またねカード' }).getByRole('button', { name: '送らない' }).click()

  // もう一度同じフォームを開いて再読み込みしても、下書きは戻らない
  await page.goto('./#/visit?c=sample-momiji&same=1')
  await expect(page.getByRole('heading', { name: '来店を記録', level: 1 })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '来店を記録', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: /くわしく/ }).click()
  await expect(page.getByLabel('会話メモ')).toHaveValue('')
  await expect(page.getByText('入力途中の内容を戻しました')).toHaveCount(0)
})

test('AC-07 来店記録を削除した直後の［元に戻す］で記録と目安・判定が戻り、10秒後は戻せず再起動後も残らない', async ({ page }) => {
  await startSample(page)
  await openCustomer(page, 'ゆず')
  const due = page.getByRole('region', { name: '次回の目安' })
  await expect(due).toContainText('ご無沙汰')
  await expect(due).toContainText('2026-10-17（土）')
  await expect(due).toContainText('約8週（直近3回）')
  // 直近の来店の行（削除後の目安日が同じ日付になることがあるので、行のリンクで確かめる）
  const visitRow = page.getByRole('link', { name: /^2026-08-22（土）/ })
  await expect(visitRow).toBeVisible()
  const target = alive((await readDb(page, SAMPLE_DB))!.visits).find((v) => v.customerId === YUZU && v.date === '2026-08-22')!

  // 1回目: 削除 → ［元に戻す］
  await visitRow.click()
  await expect(page.getByRole('heading', { name: '来店記録を直す', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'この来店記録を削除' }).click()
  await expect(page.getByRole('heading', { name: 'ゆず', level: 1 })).toBeVisible()
  await expect(page.getByText('来店記録を削除しました')).toBeVisible()
  await expect(visitRow).toHaveCount(0)
  await expect(due).toContainText('離れたかも')
  await expect(due).toContainText('約8週（直近2回）')
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(page.getByText('元に戻しました')).toBeVisible()
  await expect(due).toContainText('ご無沙汰')
  await expect(due).toContainText('2026-10-17（土）')
  await expect(due).toContainText('約8週（直近3回）')
  await expect(visitRow).toBeVisible()
  let db = (await readDb(page, SAMPLE_DB))!
  expect(db.visits.find((v) => v.id === target.id)?.deletedAt).toBeUndefined()

  // 2回目: 削除 → 10秒待つ → 戻せない・完全に消える
  await visitRow.click()
  await page.getByRole('button', { name: 'この来店記録を削除' }).click()
  await expect(page.getByText('来店記録を削除しました')).toBeVisible()
  await page.clock.fastForward(10_000)
  await expect(page.getByRole('button', { name: '元に戻す' })).toHaveCount(0)
  db = await waitForDb(page, SAMPLE_DB, (d) => !d.visits.some((v) => v.id === target.id), '完全に消える')
  await expect(due).toContainText('離れたかも')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'ゆず', level: 1 })).toBeVisible()
  await expect(due).toContainText('離れたかも')
  await expect(visitRow).toHaveCount(0)
  db = (await readDb(page, SAMPLE_DB))!
  expect(db.visits.some((v) => v.id === target.id)).toBe(false)
})

test('AC-16 会話メモの健康語に注意が出て保存はでき、文面にもまたねカードにもメモが入らない', async ({ page }) => {
  await startSample(page)
  await homeSection(page, /今日のお客様/).getByRole('link', { name: 'もみじさん 来た' }).click()
  await page.getByRole('button', { name: /くわしく/ }).click()
  await expect(page.getByText('体質・病歴・妊娠など健康のことは書かないでください').first()).toBeVisible()
  await page.getByRole('button', { name: '前回のメモを複製' }).click()
  const recipe = await page.getByLabel('レシピメモ').inputValue()
  expect(recipe).toBe('根元 ブラウン6＋グレー8 1:1／6%／30分')
  await page.getByLabel('会話メモ').fill('頭皮にアレルギーあり')
  await expect(page.getByText('健康に関することは書かないでください（要配慮個人情報にあたる場合があります）')).toBeVisible()
  await page.getByRole('button', { name: '6週' }).click()
  await page.getByRole('button', { name: '保存' }).click()

  const sheet = page.getByRole('dialog', { name: 'またねカード' })
  await expect(sheet).toBeVisible()
  const matane = await sheet.getByRole('textbox').inputValue()
  for (const s of ['アレルギー', '頭皮', recipe, 'ブラウン', '前髪は眉上']) expect(matane).not.toContain(s)

  const db = await waitForDb(page, SAMPLE_DB, (d) => alive(d.visits).some((v) => v.customerId === MOMIJI && v.date === '2026-11-07'))
  const saved = alive(db.visits).find((v) => v.customerId === MOMIJI && v.date === '2026-11-07')!
  expect(saved.talkMemo).toBe('頭皮にアレルギーあり')
  expect(saved.recipe.text).toBe(recipe)
  expect(saved.recipe.copiedFromVisitId).toBeTruthy()
  await sheet.getByRole('button', { name: '送らない' }).click()

  // その客の声かけ文面（顧客カードから）にもメモは入らない。メモは美容師が見る欄にだけ出る
  await openCustomer(page, 'もみじ')
  await page.getByRole('link', { name: '声をかける' }).click()
  await expect(page.getByText('会話: 頭皮にアレルギーあり')).toBeVisible()
  const koekake = await page.getByRole('textbox', { name: '文面' }).inputValue()
  expect(koekake.length).toBeGreaterThan(0)
  for (const s of ['アレルギー', '頭皮', recipe, 'ブラウン', '前髪は眉上']) expect(koekake).not.toContain(s)
})
