/** 声かけ（S4）の受け入れ条件: AC-02・AC-03・AC-04・AC-10 */
import { expect, test } from '@playwright/test'
import {
  alive,
  candidateNames,
  homeSection,
  LINE_SHARE_PREFIX,
  openCustomer,
  readClipboard,
  readDb,
  SAMPLE_DB,
  startSample,
  waitForDb,
  YUZU_TEXT,
} from './helpers'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

const YUZU = 'sample-yuzu'
const ANZU = 'sample-anzu'
const DAY = 24 * 60 * 60 * 1000

test('AC-02 ゆずの声かけ画面: 根拠・最終来店・文面が 8.3 と一致し、LINE の共有リンクがその文面になる', async ({ page, context }) => {
  // 外へ実際に出ないよう、LINE の共有リンクへの遷移はここで止める
  await context.route('https://line.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' }))
  await startSample(page)
  await homeSection(page, /声をかけてもよさそうな人/).getByRole('article', { name: 'ゆず' }).getByRole('link', { name: '声をかける' }).click()

  await expect(page.getByRole('heading', { name: 'ゆず', level: 1 })).toBeVisible()
  await expect(page.getByText('いつもは約8週ごと → 今回は11週')).toBeVisible()
  const last = page.locator('section').filter({ has: page.getByRole('heading', { name: '記録上の最終来店' }) })
  // 8.3: 「記録上の最終来店 2026-08-22（土）・77日前・カット・白髪染め」
  await expect(last).toContainText('記録上の最終来店2026-08-22（土）・77日前・カット・白髪染め')
  await expect(last).not.toContainText('記録が止まっています')

  const box = page.getByRole('textbox', { name: '文面' })
  await expect(box).toHaveValue(YUZU_TEXT)
  const text = await box.inputValue()
  for (const ng of ['割引', 'OFF', 'クーポン', '%', '％']) expect(text).not.toContain(ng)
  // 前回のメモは美容師が見るためだけ。文面には入らない
  await expect(page.getByText('会話: 娘さんの受験（秋）')).toBeVisible()
  expect(text).not.toContain('受験')

  // ［LINEで送る］で開く URL（画面の文面をそのまま URL エンコードしたもの）
  const openLine = async () => {
    const lineRequest = context.waitForEvent('request', (r) => r.url().startsWith('https://line.me/'))
    const popup = context.waitForEvent('page')
    await page.getByRole('button', { name: 'LINEで送る' }).click()
    const url = (await lineRequest).url()
    await (await popup).close()
    expect(url.startsWith(LINE_SHARE_PREFIX)).toBe(true)
    return decodeURIComponent(url.slice(LINE_SHARE_PREFIX.length))
  }
  expect(await openLine()).toBe(text)
  await expect(page.getByText('送りましたか？')).toBeVisible()
  await expect(page.getByRole('button', { name: '送った', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '送っていない' }).click()
  await expect(page.getByText('送りましたか？')).toHaveCount(0)

  // 手直しした文面なら、手直しした文面が渡る
  const edited = text.replace('髪の調子はいかがですか？', '髪の調子はいかがですか？ 寒くなってきましたね。')
  await box.fill(edited)
  expect(await openLine()).toBe(edited)
  await expect(page.getByText('送りましたか？')).toBeVisible()
})

test('AC-03 ［実は来ていた］で 2026-11-01 の来店を保存すると候補から外れ、判定が「まだ」になり回数が1増える', async ({ page }) => {
  await startSample(page)
  const before = (await readDb(page, SAMPLE_DB))!
  expect(before.counters[0].actuallyVisitedFixes).toBe(0)

  await homeSection(page, /声をかけてもよさそうな人/).getByRole('article', { name: 'ゆず' }).getByRole('link', { name: '声をかける' }).click()
  await page.getByRole('link', { name: '実は来ていた → 来店を追加' }).click()
  await expect(page.getByRole('heading', { name: '来店を追加', level: 1 })).toBeVisible()
  await expect(page.getByText('ゆず', { exact: true })).toBeVisible()
  await page.getByLabel('日付').fill('2026-11-01')
  // メニューは前回と同じが入っている
  await expect(page.getByRole('button', { name: '前回と同じ' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '保存' }).click()

  await expect(page.getByText('リストから外れました')).toBeVisible()
  await expect(page.getByRole('heading', { name: '声をかけてもよさそうな人（3人）' })).toBeVisible()
  expect(await candidateNames(page)).toEqual(['つばき', 'ひいらぎ', 'かりん'])

  const after = await waitForDb(page, SAMPLE_DB, (db) => db.counters[0].actuallyVisitedFixes === 1)
  const fix = alive(after.visits).find((v) => v.customerId === YUZU && v.date === '2026-11-01')
  expect(fix?.source).toBe('fix')
  expect([...fix!.menuIds].sort()).toEqual(['cut', 'gray'])

  await openCustomer(page, 'ゆず')
  const due = page.getByRole('region', { name: '次回の目安' })
  await expect(due).toContainText('今の区分')
  await expect(due).toContainText('まだ')
})

test('AC-04 ［送った］で声かけの記録が1件でき候補から消え、30日たつまで出ず、30日目に戻る', async ({ page }) => {
  await startSample(page)
  const before = (await readDb(page, SAMPLE_DB))!
  const koekakeBefore = alive(before.contacts).filter((c) => c.customerId === YUZU && c.kind === 'koekake').length
  expect(koekakeBefore).toBe(0)

  await homeSection(page, /声をかけてもよさそうな人/).getByRole('article', { name: 'ゆず' }).getByRole('link', { name: '声をかける' }).click()
  await page.getByRole('button', { name: 'コピー' }).click()
  await expect(page.getByText('送りましたか？')).toBeVisible()
  expect(await readClipboard(page)).toBe(YUZU_TEXT)
  await page.getByRole('button', { name: '送った', exact: true }).click()

  await expect(page.getByRole('heading', { name: '声をかけてもよさそうな人（3人）' })).toBeVisible()
  expect(await candidateNames(page)).not.toContain('ゆず')
  const after = await waitForDb(page, SAMPLE_DB, (db) => alive(db.contacts).some((c) => c.customerId === YUZU))
  const logs = alive(after.contacts).filter((c) => c.customerId === YUZU)
  expect(logs).toHaveLength(1)
  expect(logs[0]).toMatchObject({ kind: 'koekake', via: 'copy', date: '2026-11-07' })
  expect(after.counters[0].koekakeSent).toBe(before.counters[0].koekakeSent + 1)

  // 開いたまま 2026-12-06 になる（1分ごとの見直しで日付が変わる）→ まだ出ない（声をかけてから29日）
  // 一度に進められるのは約24日までなので分けて進める
  await page.clock.fastForward(15 * DAY)
  await page.clock.fastForward(14 * DAY)
  await expect(page.getByText('所属サロンの顧客 1人・連絡しない 1人・声をかけてから30日以内 1人は出していません', { exact: true })).toBeVisible()
  expect(await candidateNames(page)).not.toContain('ゆず')
  expect(await candidateNames(page)).toEqual(['つばき', 'なずな', 'ひいらぎ', 'かりん'])

  // 2026-12-07 → 来店がなければ候補に戻る
  await page.clock.fastForward(DAY)
  await expect.poll(() => candidateNames(page)).toContain('ゆず')
  expect(await candidateNames(page)).toEqual(['つばき', 'なずな', 'ゆず', 'ひいらぎ', 'かりん'])

  // 開き直しても同じ（日付は端末の時計から計算し直す）
  await page.reload()
  await expect.poll(() => candidateNames(page)).toEqual(['つばき', 'なずな', 'ゆず', 'ひいらぎ', 'かりん'])
})

test('AC-10 所属サロンの顧客は注意を確かめるまで文面に進めず、文面に自分用の予約リンクが入らない', async ({ page }) => {
  await startSample(page)
  await openCustomer(page, 'あんず')
  await expect(page.getByText('管理者 所属サロン')).toBeVisible()
  await page.getByRole('link', { name: '声をかける' }).click()

  const warning = page.getByRole('alert').filter({ hasText: '所属サロンの顧客です' })
  await expect(warning).toBeVisible()
  await expect(warning).toContainText(
    'この方のデータの管理者は所属サロンです。所属先の了解なく個人の連絡先から案内すると、契約や法令上の問題になることがあります。所属先のルールで認められている場合だけ続けてください。',
  )
  await expect(warning.getByRole('link', { name: 'やめる' })).toBeVisible()
  // 続けるまで文面・送るボタンは出ない
  await expect(page.getByRole('textbox', { name: '文面' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'コピー' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'LINEで送る' })).toHaveCount(0)

  await warning.getByRole('button', { name: '認められているので続ける' }).click()
  const box = page.getByRole('textbox', { name: '文面' })
  await expect(box).toBeVisible()
  const text = await box.inputValue()
  expect(text.startsWith('あんずさん、こんにちは。')).toBe(true)
  expect(text).not.toContain('https://example.com/booking')
  expect(text).not.toContain('ご予約はこちらから')
  expect(text.split('\n')).toHaveLength(4)

  await page.getByRole('button', { name: 'コピー' }).click()
  expect(await readClipboard(page)).toBe(text)
  await page.getByRole('button', { name: '送った', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'あんず', level: 1 })).toBeVisible()

  const db = await waitForDb(page, SAMPLE_DB, (d) => alive(d.contacts).some((c) => c.customerId === ANZU))
  const log = alive(db.contacts).find((c) => c.customerId === ANZU)
  expect(log).toMatchObject({ kind: 'koekake', via: 'copy', stewardWarningAcked: true })
})
