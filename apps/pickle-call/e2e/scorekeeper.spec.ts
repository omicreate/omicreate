// スコア係の中心の流れ（仕様 §18 の 1〜8 と 16）。期待値は §9 のゴールデン表（src/domain/engine.test.ts と同じ）。
import {
  callOf,
  chip,
  chipQuadrants,
  expect,
  expectQuadrant,
  expectRole,
  quadrantOf,
  rallies,
  rally,
  spoken,
  startGame,
  stored,
  test,
  wakeLockCalls,
} from './fixtures'
import type { Page } from '@playwright/test'
import type { PlayerId, Team } from './fixtures'

type Side = 'right' | 'left'
interface Row {
  win: Team | null
  call: string
  server: PlayerId
  side: Side
  receiver: PlayerId
  aRight: PlayerId
  bRight: PlayerId
}

const R = (win: Team | null, call: string, server: PlayerId, side: Side, receiver: PlayerId, aRight: PlayerId, bRight: PlayerId): Row => ({
  win,
  call,
  server,
  side,
  receiver,
  aRight,
  bRight,
})

/** §9① ダブルス・サイドアウト方式（経過 A A B B A A B B B A） */
const DOUBLES_SIDEOUT: Row[] = [
  R(null, '0-0-2', 'A1', 'right', 'B1', 'A1', 'B1'),
  R('A', '1-0-2', 'A1', 'left', 'B2', 'A2', 'B1'),
  R('A', '2-0-2', 'A1', 'right', 'B1', 'A1', 'B1'),
  R('B', '0-2-1', 'B1', 'right', 'A1', 'A1', 'B1'),
  R('B', '1-2-1', 'B1', 'left', 'A2', 'A1', 'B2'),
  R('A', '1-2-2', 'B2', 'right', 'A1', 'A1', 'B2'),
  R('A', '2-1-1', 'A1', 'right', 'B2', 'A1', 'B2'),
  R('B', '2-1-2', 'A2', 'left', 'B1', 'A1', 'B2'),
  R('B', '1-2-1', 'B2', 'right', 'A1', 'A1', 'B2'),
  R('B', '2-2-1', 'B2', 'left', 'A2', 'A1', 'B1'),
  R('A', '2-2-2', 'B1', 'right', 'A1', 'A1', 'B1'),
]

/** §9③ ダブルス・ラリー方式（A B B A A B） */
const DOUBLES_RALLY: Row[] = [
  R(null, '0-0', 'A1', 'right', 'B1', 'A1', 'B1'),
  R('A', '1-0', 'A1', 'left', 'B2', 'A2', 'B1'),
  R('B', '1-1', 'B2', 'right', 'A2', 'A2', 'B2'),
  R('B', '2-1', 'B2', 'left', 'A1', 'A2', 'B1'),
  R('A', '2-2', 'A1', 'right', 'B1', 'A1', 'B1'),
  R('A', '3-2', 'A1', 'left', 'B2', 'A2', 'B1'),
  R('B', '3-3', 'B2', 'right', 'A2', 'A2', 'B2'),
]

const other = (p: PlayerId): PlayerId => (({ A1: 'A2', A2: 'A1', B1: 'B2', B2: 'B1' }) as const)[p]
const teamOf = (p: PlayerId): Team => (p[0] === 'A' ? 'A' : 'B')

/** 1段ぶんの表示（コール・サーバーとレシーバーの印・4人の区画）がゴールデン表と一致するか */
async function expectDoublesRow(page: Page, row: Row, i: number) {
  await expect(callOf(page), `row ${i} call`).toHaveText(row.call)
  await expectRole(page, row.server, 'server')
  await expectRole(page, row.receiver, 'receiver')
  await expectQuadrant(page, row.server, quadrantOf(teamOf(row.server), row.side))
  // レシーバーはサーバーの対角（同じ側）にいる
  await expectQuadrant(page, row.receiver, quadrantOf(teamOf(row.receiver), row.side))
  await expectQuadrant(page, row.aRight, 'BR')
  await expectQuadrant(page, other(row.aRight), 'BL')
  await expectQuadrant(page, row.bRight, 'TL')
  await expectQuadrant(page, other(row.bRight), 'TR')
}

test.describe('スコア係', () => {
  test('1. 既定の設定で開始すると 0-0-2 が出て、最初のコールを読み、Wake Lock を1回とる', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('link', { name: '試合をはじめる' }).click()
    await expect(page).toHaveURL(/#\/setup$/)
    await page.getByTestId('setup-start').click()
    await expect(page).toHaveURL(/#\/play$/)
    await expect(callOf(page)).toHaveText('0-0-2')
    await expect(page.getByTestId('call-spoken')).toContainText('ゼロ、ゼロ、ツー')
    const s = await spoken(page)
    expect(s[0]).toMatch(/^ゼロ、ゼロ、ツー/)
    // 遅れて2回目の要求が出ないことも確かめる
    await page.waitForTimeout(300)
    expect(await wakeLockCalls(page)).toBe(1)
    await expectRole(page, 'A1', 'server')
    await expectRole(page, 'B1', 'receiver')
    await expect(page.getByTestId('undo')).toBeDisabled()
  })

  test('2-3. §9① の列でゴールデン表どおりに進み、1手戻す×3で 2-1-2 に戻る', async ({ page }) => {
    await startGame(page)
    await expectDoublesRow(page, DOUBLES_SIDEOUT[0], 0)
    for (let i = 1; i < DOUBLES_SIDEOUT.length; i += 1) {
      const row = DOUBLES_SIDEOUT[i]
      await rally(page, row.win!)
      await expectDoublesRow(page, row, i)
      // サーブ側のチームが替わった直後だけ「サイドアウト」を出す
      const sideOut = teamOf(row.server) !== teamOf(DOUBLES_SIDEOUT[i - 1].server)
      await expect(page.getByTestId('status-sideout'), `row ${i} side out`).toHaveCount(sideOut ? 1 : 0)
    }
    // 2. 最後は 2-2-2。サーバーは B1（左上）、レシーバーは A1（右下）
    await expect(callOf(page)).toHaveText('2-2-2')
    await expect(chip(page, 'B1')).toHaveAttribute('data-role', 'server')
    await expect(chip(page, 'B1')).toHaveAttribute('data-quadrant', 'TL')
    await expect(chip(page, 'A1')).toHaveAttribute('data-role', 'receiver')
    await expect(chip(page, 'A1')).toHaveAttribute('data-quadrant', 'BR')
    await expect(page.getByTestId('play-sub')).toContainText('2人目')

    // 3. 1手戻す×3 → 2-1-2（サーバー A2・左）
    for (let k = 0; k < 3; k += 1) await page.getByTestId('undo').click()
    await expectDoublesRow(page, DOUBLES_SIDEOUT[7], 7)
    await expect(page.getByTestId('play-sub')).toContainText('A2')
    await expect(page.getByTestId('play-sub')).toContainText('左から')
    await expect(page.getByTestId('play-sub')).toContainText('2人目')
  })

  test('4. 新しい試合で A が11連勝 → 結果 11-0・A の勝ち・履歴1件、次のゲームは B のサーブで 0-0-2', async ({ page }) => {
    // 途中までの試合を、設定画面から新しい試合で置きかえる（置きかえた試合は履歴に残らない）
    await startGame(page)
    await rallies(page, 'AB')
    await expect(callOf(page)).toHaveText('0-1-1')
    await startGame(page)
    await expect(callOf(page)).toHaveText('0-0-2')

    for (let i = 1; i <= 10; i += 1) {
      await rally(page, 'A')
      await expect(callOf(page)).toHaveText(`${i}-0-2`)
    }
    await expect(page.getByTestId('status-gamepoint-A')).toBeVisible()
    await page.getByTestId('rally-A').click()
    // 決着したらボタンは押せなくなり、0.6秒後に結果へ
    await expect(page.getByTestId('rally-A')).toBeDisabled()
    await expect(page.getByTestId('rally-B')).toBeDisabled()
    await expect(page).toHaveURL(/#\/result$/)
    await expect(page.getByTestId('result-score')).toHaveText('11-0')
    await expect(page.getByTestId('result-winner')).toHaveAttribute('data-team', 'A')
    await expect(page.getByTestId('result-winner')).toContainText('Aチームの勝ち')
    await expect(page.getByTestId('result-rallies')).toHaveText('11')
    await expect(page.getByTestId('result-sideouts')).toHaveText('0')
    const s = await spoken(page)
    expect(s[s.length - 1]).toMatch(/^ゲーム。Aチームの勝ち、11対0/)

    const hist = await stored<unknown[]>(page, 'history')
    expect(hist).toHaveLength(1)

    await page.getByTestId('next-game').click()
    await expect(page).toHaveURL(/#\/play$/)
    await expect(callOf(page)).toHaveText('0-0-2')
    await expect(callOf(page)).toHaveAttribute('data-serving', 'B')
    await expectRole(page, 'B1', 'server')
    await expectQuadrant(page, 'B1', 'TL')
    await expectRole(page, 'A1', 'receiver')
    await expectQuadrant(page, 'A1', 'BR')

    // 履歴の画面にも1件
    await page.goto('./#/history')
    await expect(page.locator('.hs-list > li')).toHaveCount(1)
    await expect(page.locator('.hs-count')).toContainText('1')
  })

  test('5. ラリー方式のダブルス: §9③ の列で、コールが2つの数字になり各段がゴールデン表と一致する', async ({ page }) => {
    await startGame(page, { scoring: 'rally' })
    await expectDoublesRow(page, DOUBLES_RALLY[0], 0)
    for (let i = 1; i < DOUBLES_RALLY.length; i += 1) {
      const row = DOUBLES_RALLY[i]
      await rally(page, row.win!)
      await expectDoublesRow(page, row, i)
      expect((await callOf(page).innerText()).split('-')).toHaveLength(2)
    }
  })

  test('6. シングルス: §9② の列で、サーバーのチップの位置が点数の偶奇どおりになる', async ({ page }) => {
    await startGame(page, { kind: 'singles' })
    const calls = ['0-0', '1-0', '2-0', '3-0', '0-3', '1-3', '2-3', '3-2']
    const servers: [PlayerId, Side][] = [
      ['A1', 'right'],
      ['A1', 'left'],
      ['A1', 'right'],
      ['A1', 'left'],
      ['B1', 'right'],
      ['B1', 'left'],
      ['B1', 'right'],
      ['A1', 'left'],
    ]
    const seq: Team[] = ['A', 'A', 'A', 'B', 'B', 'B', 'A']
    await expect(page.getByTestId('chip-A2')).toHaveCount(0)
    for (let i = 0; i < calls.length; i += 1) {
      if (i > 0) await rally(page, seq[i - 1])
      await expect(callOf(page), `step ${i}`).toHaveText(calls[i])
      const [server, side] = servers[i]
      const receiver: PlayerId = server === 'A1' ? 'B1' : 'A1'
      await expectRole(page, server, 'server')
      await expectQuadrant(page, server, quadrantOf(teamOf(server), side))
      // サーバーの側はサーバーの点数の偶奇（偶数=右）。レシーバーは対角
      const serverScore = Number(calls[i].split('-')[0])
      expect(side).toBe(serverScore % 2 === 0 ? 'right' : 'left')
      await expectRole(page, receiver, 'receiver')
      await expectQuadrant(page, receiver, quadrantOf(teamOf(receiver), side))
    }
  })

  test('7. スコアを直す: 5-3・サーバー2 → 5-3-2。取り消しで直す前に戻る', async ({ page }) => {
    await startGame(page)
    await rallies(page, 'AA')
    await expect(callOf(page)).toHaveText('2-0-2')
    const before = await chipQuadrants(page, ['A1', 'A2', 'B1', 'B2'])

    await page.getByTestId('menu').click()
    await page.getByTestId('menu-fix').click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toBeVisible()
    await page.getByTestId('fix-score-A').fill('5')
    await page.getByTestId('fix-score-B').fill('3')
    await page.getByTestId('fix-serving-A').click()
    await page.getByTestId('fix-num-2').click()
    await expect(page.getByTestId('fix-preview-call')).toHaveText('5-3-2')
    await page.getByTestId('fix-save').click()
    await expect(page.locator('dialog[open]')).toHaveCount(0)

    await expect(callOf(page)).toHaveText('5-3-2')
    // 立ち位置は点数の偶奇から: A 5点（奇数）→ A1 は左、B 3点（奇数）→ B1 は左
    await expectQuadrant(page, 'A1', 'BL')
    await expectQuadrant(page, 'A2', 'BR')
    await expectQuadrant(page, 'B1', 'TR')
    await expectQuadrant(page, 'B2', 'TL')
    const s = await spoken(page)
    expect(s[s.length - 1]).toMatch(/^ファイブ、スリー、ツー/)

    await page.getByTestId('undo').click()
    await expect(callOf(page)).toHaveText('2-0-2')
    expect(await chipQuadrants(page, ['A1', 'A2', 'B1', 'B2'])).toEqual(before)
  })

  test('8. 試合中にリロードしても、同じコールと立ち位置に戻る（ホームの「続きから」でも）', async ({ page }) => {
    await startGame(page, { names: { A1: 'あおい', A2: 'そら', B1: 'りく', B2: 'はな' } })
    await rallies(page, 'AABBA')
    const call = await callOf(page).innerText()
    expect(call).toBe('1-2-2')
    const ids: PlayerId[] = ['A1', 'A2', 'B1', 'B2']
    const quads = await chipQuadrants(page, ids)
    const sub = await page.getByTestId('play-sub').innerText()

    await page.reload()
    await expect(callOf(page)).toHaveText(call)
    expect(await chipQuadrants(page, ids)).toEqual(quads)
    await expect(page.getByTestId('play-sub')).toHaveText(sub)
    await expect(chip(page, 'B2')).toContainText('はな')

    await page.goto('./#/')
    const resume = page.getByRole('link', { name: /続きから/ })
    await expect(resume).toBeVisible()
    await expect(resume).toContainText(call)
    await resume.click()
    await expect(page).toHaveURL(/#\/play$/)
    await expect(callOf(page)).toHaveText(call)
    expect(await chipQuadrants(page, ids)).toEqual(quads)
    // 戻った後も続けて記録できる
    await rally(page, 'A')
    await expect(callOf(page)).toHaveText('2-1-1')
  })

  test('16. 連打: 100ms 間隔で2回押しても1点しか入らない', async ({ page }) => {
    await startGame(page)
    const btn = page.getByTestId('rally-A')
    await btn.click()
    await page.waitForTimeout(100)
    await btn.click()
    await page.waitForTimeout(400)
    await expect(callOf(page)).toHaveText('1-0-2')
    expect(await stored<{ events: unknown[] }>(page, 'current').then((c) => c?.events.length)).toBe(1)
    // 間をあければ次の1点は入る
    await btn.click()
    await expect(callOf(page)).toHaveText('2-0-2')
  })

  test('試合をやめるとホームに戻り、続きからは出ない', async ({ page }) => {
    await startGame(page)
    await rally(page, 'A')
    await page.getByTestId('menu').click()
    await page.getByTestId('menu-quit').click()
    await page.getByTestId('quit-confirm').click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByRole('link', { name: /続きから/ })).toHaveCount(0)
    expect(await stored(page, 'current')).toBeNull()
  })
})
