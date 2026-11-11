/** AC-20: 起動から一連の操作（記録・声かけ・バックアップ）のあいだ、自分のオリジン以外への通信が0件で、Cookie も作られない */
import { expect, test, type Request } from '@playwright/test'
import { homeSection, LINE_SHARE_PREFIX, openSettings, startSample, tab } from './helpers'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('AC-20 自分のオリジン以外への通信が0件（［LINEで送る］の遷移はその URL だけを確かめる）で、Cookie が1つもない', async ({ page, context, baseURL }) => {
  const own = new URL(baseURL!).origin
  const requests: Request[] = []
  context.on('request', (r) => requests.push(r))
  const sockets: string[] = []
  page.on('websocket', (ws) => sockets.push(ws.url()))
  // LINE の共有リンクだけは外へ出さずにここで止める（URL は確かめる）
  await context.route('https://line.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' }))

  await startSample(page)

  // 記録（もみじ・6週）→ またねカードをコピーして［送った］
  await homeSection(page, /今日のお客様/).getByRole('link', { name: 'もみじさん 来た' }).click()
  await page.getByRole('button', { name: '6週' }).click()
  await page.getByRole('button', { name: '保存' }).click()
  const sheet = page.getByRole('dialog', { name: 'またねカード' })
  await sheet.getByRole('button', { name: 'コピー' }).click()
  await sheet.getByRole('button', { name: '送った', exact: true }).click()
  await expect(sheet).toHaveCount(0)

  // 声かけ（ゆず）: ［LINEで送る］→［送った］
  await homeSection(page, /声をかけてもよさそうな人/).getByRole('article', { name: 'ゆず' }).getByRole('link', { name: '声をかける' }).click()
  const text = await page.getByRole('textbox', { name: '文面' }).inputValue()
  const popup = context.waitForEvent('page')
  await page.getByRole('button', { name: 'LINEで送る' }).click()
  await (await popup).close()
  await page.getByRole('button', { name: '送った', exact: true }).click()
  await expect(page.getByRole('heading', { name: /声をかけてもよさそうな人/ })).toBeVisible()

  // ボードと数字のコピー
  await tab(page, 'ボード')
  await page.getByRole('button', { name: '数字をコピー（名前は含まない）' }).click()

  // バックアップ（暗号化）
  await openSettings(page, 'データ')
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'バックアップを書き出す（暗号化）' }) })
  await section.getByLabel('パスフレーズ（8文字以上）').fill('privacy-pass-1')
  await section.getByLabel('もう一度').fill('privacy-pass-1')
  await section.getByLabel('パスフレーズを忘れると戻せないことを確認しました').check()
  const download = page.waitForEvent('download')
  await section.getByRole('button', { name: 'バックアップを書き出す（暗号化）' }).click()
  await download
  await expect(page.getByText('バックアップを書き出しました')).toBeVisible()

  // 通信の確認
  const lineRequests = requests.filter((r) => r.url().startsWith('https://line.me/'))
  expect(lineRequests).toHaveLength(1)
  expect(lineRequests[0].url().startsWith(LINE_SHARE_PREFIX)).toBe(true)
  expect(decodeURIComponent(lineRequests[0].url().slice(LINE_SHARE_PREFIX.length))).toBe(text)
  const external = requests
    .filter((r) => !lineRequests.includes(r))
    .map((r) => r.url())
    .filter((u) => !u.startsWith('data:') && new URL(u).origin !== own)
  expect(external).toEqual([])
  // 記録が取れていること（アプリ本体の読み込みが入っている）
  expect(requests.some((r) => new URL(r.url()).origin === own && r.resourceType() === 'script')).toBe(true)
  expect(sockets).toEqual([])

  // Cookie は1つも作られない（外の LINE のページも含めて）
  expect(await context.cookies()).toEqual([])
  expect(await page.evaluate(() => document.cookie)).toBe('')
})
