/**
 * 予約を入れる（S10、仕様にない追加）。会計のあとで LINE・電話で入った予約を、美容師が自分で手入力する。
 * - 貼った文から日付だけを読み、時刻は捨てる
 * - 貼った文はどこにも保存しない
 */
import { expect, test, type Page } from '@playwright/test'
import { alive, candidateNames, dbNames, homeSection, openCustomer, openSettings, readDb, SAMPLE_DB, startSample, waitForDb } from './helpers'

const DAY = 24 * 60 * 60 * 1000
const LINE_TEXT = '20日の14時でお願いします！'

/** すべてのデータベースと localStorage を文字列にまとめる */
async function everythingStored(page: Page): Promise<string> {
  const parts: string[] = []
  for (const name of await dbNames(page)) parts.push(JSON.stringify(await readDb(page, name)))
  parts.push(await page.evaluate(() => JSON.stringify({ ...localStorage })))
  parts.push(await page.evaluate(() => JSON.stringify({ ...sessionStorage })))
  return parts.join('\n')
}

test('(a)(c) つばきに LINE の文を貼る → 11月20日（金）で保存 → 候補から消え、11/20 に今日のお客様に出る。貼った文はどこにも残らない', async ({ page }) => {
  await startSample(page)
  expect(await candidateNames(page)).toEqual(['つばき', 'ゆず', 'ひいらぎ', 'かりん'])

  await openCustomer(page, 'つばき')
  const bookingCard = page.locator('section').filter({ has: page.getByRole('heading', { name: '予約', exact: true }) })
  await expect(bookingCard).toContainText('入っていません')
  await bookingCard.getByRole('link', { name: '予約日を入れる' }).click()
  await expect(page.getByRole('heading', { name: '予約を入れる', level: 1 })).toBeVisible()
  await expect(page.getByText('つばき', { exact: true })).toBeVisible()
  await expect(page.getByText('貼った文は保存しません。日付だけ残します')).toBeVisible()

  // 貼り付け（クリップボードからの貼り付けと同じく、欄に文がまるごと入る）
  const field = page.getByLabel('予約日（貼り付け・入力・音声入力）')
  await field.focus()
  await page.evaluate((t) => document.execCommand('insertText', false, t), LINE_TEXT)
  await expect(field).toHaveValue(LINE_TEXT)
  await expect(page.getByText('読み取った日付 11月20日（金）')).toBeVisible()
  await expect(page.getByText('時刻は残しません')).toBeVisible()
  await expect(page.getByLabel('カレンダーで確かめる・選ぶ')).toHaveValue('2026-11-20')

  // (c) 入力中（下書きの自動保存の間隔より長く待つ）も、貼った文は保存されない
  await page.waitForTimeout(1000)
  let stored = await everythingStored(page)
  expect(stored).not.toContain('お願いします')
  expect(stored).not.toContain('14時')

  await page.getByRole('button', { name: '予約を保存' }).click()
  await expect(page.getByRole('heading', { name: 'つばき', level: 1 })).toBeVisible()
  await expect(page.getByText('つばきさんの予約を11月20日（金）に入れました')).toBeVisible()
  await expect(bookingCard).toContainText('11月20日（金）')
  await expect(bookingCard).toContainText('あとから入れた予約')
  await expect(bookingCard.getByRole('link', { name: '予約日を変える' })).toBeVisible()
  await expect(bookingCard.getByRole('button', { name: '予約を取り消す' })).toBeVisible()

  // 保存したのは日付と入れた日時だけ
  const db = await waitForDb(page, SAMPLE_DB, (d) => alive(d.customers).some((c) => c.nickname === 'つばき' && c.booking))
  const tsubaki = alive(db.customers).find((c) => c.nickname === 'つばき')!
  expect(Object.keys(tsubaki.booking).sort()).toEqual(['date', 'setAt'])
  expect(tsubaki.booking.date).toBe('2026-11-20')
  stored = await everythingStored(page)
  expect(stored).not.toContain('お願いします')
  expect(stored).not.toContain('14時')

  // つばきは候補から消える
  await page.getByRole('navigation', { name: '画面の切り替え' }).getByRole('link', { name: 'ホーム' }).click()
  await expect(page.getByRole('heading', { name: '声をかけてもよさそうな人（3人）' })).toBeVisible()
  expect(await candidateNames(page)).toEqual(['ゆず', 'ひいらぎ', 'かりん'])
  await expect(homeSection(page, /今日のお客様/)).not.toContainText('つばき')

  // 11/20 になると今日のお客様に出る
  await page.clock.fastForward(13 * DAY)
  await expect(homeSection(page, /今日のお客様/)).toContainText('つばき')
  await expect(homeSection(page, /今日のお客様/).getByRole('link', { name: 'つばきさん 来た' })).toBeVisible()
})

test('(b) 電話の新しいお客様「さくら」を登録して「明日」で保存 → 11/8 に今日のお客様、11/9 に来た？に出る', async ({ page }) => {
  await startSample(page)
  await page.getByRole('link', { name: '予約を入れる' }).click()
  await expect(page.getByRole('heading', { name: '予約を入れる', level: 1 })).toBeVisible()

  await page.getByPlaceholder('呼び名・かなで探す').fill('さくら')
  await expect(page.getByText('見つかりませんでした')).toBeVisible()
  await page.getByRole('button', { name: '新しいお客様として登録' }).click()
  await expect(page.getByLabel('呼び名')).toHaveValue('さくら')

  await page.getByLabel('予約日（貼り付け・入力・音声入力）').fill('明日')
  await expect(page.getByText('読み取った日付 11月8日（日）')).toBeVisible()

  // 管理者・経路は来店記録の新規客と同じく必須
  await page.getByRole('button', { name: '予約を保存' }).click()
  await expect(page.getByText('データの管理者を選んでください')).toBeVisible()
  await expect(page.getByText('獲得経路を選んでください')).toBeVisible()
  await page.getByRole('radio', { name: '本人' }).click()
  await page.getByLabel('獲得経路').selectOption({ label: '本人のその他' })
  await page.getByRole('button', { name: '予約を保存' }).click()

  await expect(page.getByRole('heading', { name: /声をかけてもよさそうな人/ })).toBeVisible()
  const db = await waitForDb(page, SAMPLE_DB, (d) => alive(d.customers).some((c) => c.nickname === 'さくら'))
  const sakura = alive(db.customers).find((c) => c.nickname === 'さくら')!
  expect(sakura).toMatchObject({ stewardship: { steward: 'self', channel: 'own_other' }, booking: { date: '2026-11-08' } })
  expect(alive(db.visits).some((v) => v.customerId === sakura.id)).toBe(false)
  expect(await candidateNames(page)).not.toContain('さくら')

  // 11/8: 今日のお客様（来店記録はまだないので「はじめてのご来店」）
  await page.clock.fastForward(DAY)
  const todays = homeSection(page, /今日のお客様/)
  await expect(todays).toContainText('さくら')
  await expect(todays.getByRole('listitem').filter({ hasText: 'さくら' })).toContainText('はじめてのご来店')

  // 11/9: 来た？の確認
  await page.clock.fastForward(DAY)
  const confirms = homeSection(page, /来た？の確認/)
  await expect(confirms).toContainText('さくら')
  await expect(confirms.locator('.card').filter({ hasText: 'さくら' })).toContainText('予約 11月8日（日）')
  await expect(homeSection(page, /今日のお客様/)).not.toContainText('さくら')

  // ［来なかった］で予約を消す
  await confirms.locator('.card').filter({ hasText: 'さくら' }).getByRole('button', { name: '来なかった' }).click()
  await expect(page.getByText('さくらさんを「来なかった」にしました')).toBeVisible()
  await waitForDb(page, SAMPLE_DB, (d) => !alive(d.customers).find((c) => c.nickname === 'さくら')?.booking)
  await expect(homeSection(page, /来た？の確認/)).not.toContainText('さくら')
})

test('日付が2つ・読めない・過去は知らせ、予約日を変えるときは前の日付を出す', async ({ page }) => {
  await startSample(page)
  // すずらんは会計時に入れた予約（11/4）がある
  await openCustomer(page, 'すずらん')
  const bookingCard = page.locator('section').filter({ has: page.getByRole('heading', { name: '予約', exact: true }) })
  await expect(bookingCard).toContainText('11月4日（水）')
  await expect(bookingCard).toContainText('会計時に入れた予約')
  await bookingCard.getByRole('link', { name: '予約日を変える' }).click()
  await expect(page.getByText('いまの予約 11月4日（水）（会計時）')).toBeVisible()

  const field = page.getByLabel('予約日（貼り付け・入力・音声入力）')
  await field.fill('よろしくお願いします')
  await expect(page.getByText('日付が読み取れませんでした。カレンダーで選んでください')).toBeVisible()
  await field.fill('20日か21日で')
  await expect(page.getByText('日付が2つありました。合っているか確かめてください')).toBeVisible()
  await expect(page.getByText('読み取った日付 11月20日（金）')).toBeVisible()
  await expect(page.getByText('11月4日の予約を11月20日に変えます')).toBeVisible()
  // カレンダーで上書きできる
  await page.getByLabel('カレンダーで確かめる・選ぶ').fill('2026-11-21')
  await expect(page.getByText('11月4日の予約を11月21日に変えます')).toBeVisible()
  await field.fill('2026-11-01')
  await expect(page.getByText('過去の日付は入れられません。カレンダーで選び直してください')).toBeVisible()
  await page.getByRole('button', { name: '予約日を保存' }).click()
  await expect(page.getByRole('heading', { name: '予約を入れる', level: 1 })).toBeVisible()

  await field.fill('来週火曜')
  await expect(page.getByText('読み取った日付 11月10日（火）')).toBeVisible()
  await page.getByRole('button', { name: '予約日を保存' }).click()
  await expect(page.getByRole('heading', { name: 'すずらん', level: 1 })).toBeVisible()
  await expect(bookingCard).toContainText('11月10日（火）')

  // すずらんは来た？から外れる（予約日が先になった）
  await page.getByRole('navigation', { name: '画面の切り替え' }).getByRole('link', { name: 'ホーム' }).click()
  await expect(homeSection(page, /今日のお客様/)).toBeVisible()
  await expect(homeSection(page, /来た？の確認/)).toHaveCount(0)

  // 変えた時点で、会計時の予約（11/4）は「予約日を変えた」として片付けてある
  await waitForDb(page, SAMPLE_DB, (d) =>
    alive(d.visits).some((v) => v.next?.kind === 'booked' && v.next.date === '2026-11-04' && v.bookingResolution === 'replaced'),
  )

  // 顧客カードの［予約を取り消す］→ 古い予約（11/4）には戻らず、来た？にも出ない
  await openCustomer(page, 'すずらん')
  await bookingCard.getByRole('button', { name: '予約を取り消す' }).click()
  await expect(page.getByText('すずらんさんの予約を取り消しました')).toBeVisible()
  await expect(bookingCard).toContainText('入っていません')

  // 取り消しを元に戻すと 11/10 の予約に戻り、もう一度取り消す
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(bookingCard).toContainText('11月10日（火）')
  await bookingCard.getByRole('button', { name: '予約を取り消す' }).click()
  await expect(bookingCard).toContainText('入っていません')

  await page.getByRole('navigation', { name: '画面の切り替え' }).getByRole('link', { name: 'ホーム' }).click()
  await expect(homeSection(page, /今日のお客様/)).toBeVisible()
  await expect(homeSection(page, /来た？の確認/)).toHaveCount(0)
})

test('読み取れた日付のあとで読めない文に変えたら、前の日付では保存しない', async ({ page }) => {
  await startSample(page)
  await openCustomer(page, 'つばき')
  await page.getByRole('link', { name: '予約日を入れる' }).click()
  const field = page.getByLabel('予約日（貼り付け・入力・音声入力）')
  const picker = page.getByLabel('カレンダーで確かめる・選ぶ')
  await field.fill('20日')
  await expect(picker).toHaveValue('2026-11-20')
  await field.fill('来月の頭あたりで')
  await expect(page.getByText('日付が読み取れませんでした。カレンダーで選んでください')).toBeVisible()
  await expect(picker).toHaveValue('')
  await page.getByRole('button', { name: '予約を保存' }).click()
  await expect(page.getByRole('heading', { name: '予約を入れる', level: 1 })).toBeVisible()
  const db = await readDb(page, SAMPLE_DB)
  expect(alive(db?.customers).find((c) => c.nickname === 'つばき')?.booking).toBeUndefined()

  // カレンダーで選べば保存できる
  await picker.fill('2026-11-21')
  await page.getByRole('button', { name: '予約を保存' }).click()
  await expect(page.getByRole('heading', { name: 'つばき', level: 1 })).toBeVisible()
  await waitForDb(page, SAMPLE_DB, (d) => alive(d.customers).find((c) => c.nickname === 'つばき')?.booking?.date === '2026-11-21')
})

test('お客様がまだいなくてもホームから［予約を入れる］へ行け、客を選ぶとすぐ日付の欄に入れる', async ({ page }) => {
  await startSample(page)
  // 最近の客を選ぶと、日付の欄にすぐ入れる（ホームから3回: 客 → 日付 → 保存）
  await page.getByRole('link', { name: '予約を入れる' }).click()
  await page.locator('.chip').first().click()
  await expect(page.getByLabel('予約日（貼り付け・入力・音声入力）')).toBeFocused()

  await openSettings(page, 'サンプル')
  await page.getByRole('button', { name: 'サンプルを消して自分のお客様で始める' }).click()
  await expect(page.getByRole('link', { name: 'ざっくり登録' })).toBeVisible()
  await page.getByRole('link', { name: '予約を入れる' }).click()
  await expect(page.getByRole('heading', { name: '予約を入れる', level: 1 })).toBeVisible()
  await page.getByPlaceholder('呼び名・かなで探す').fill('さくら')
  await expect(page.getByRole('button', { name: '新しいお客様として登録' })).toBeVisible()
})
