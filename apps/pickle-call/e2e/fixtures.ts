// E2E の共通部品。読み上げと Wake Lock を差し替えて記録し、よく使う操作をまとめる。
import { test as base, expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export type Team = 'A' | 'B'
export type PlayerId = 'A1' | 'A2' | 'B1' | 'B2'
export type Quadrant = 'TL' | 'TR' | 'BL' | 'BR'

declare global {
  interface Window {
    __spoken: string[]
    __spokenLangs: string[]
    __wakeLockCalls: number
  }
}

/** speechSynthesis を差し替え、話した文を window.__spoken に記録する。Wake Lock の要求も数える */
export function stubDevices(opts: { speech: boolean }) {
  window.__spoken = []
  window.__spokenLangs = []
  window.__wakeLockCalls = 0
  if (opts.speech) {
    if (typeof window.SpeechSynthesisUtterance === 'undefined') {
      class Utterance {
        text: string
        lang = ''
        rate = 1
        voice: unknown = null
        constructor(text: string) {
          this.text = text
        }
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true, writable: true })
    }
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      onvoiceschanged: null,
      speak(u: SpeechSynthesisUtterance) {
        window.__spoken.push(u.text)
        window.__spokenLangs.push(u.lang)
      },
      cancel() {},
      pause() {},
      resume() {},
      getVoices: () => [],
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => true,
    }
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true })
  } else {
    // 読み上げのない端末
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true, writable: true })
  }
  const wakeLock = {
    request: async (type: string) => {
      window.__wakeLockCalls += 1
      const s = {
        type,
        released: false,
        release: async () => {
          s.released = true
        },
        addEventListener() {},
        removeEventListener() {},
      }
      return s
    },
  }
  Object.defineProperty(navigator, 'wakeLock', { value: wakeLock, configurable: true })
  // 共有はクリップボードへのコピーに落ちる（ダイアログを開かない）
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
}

type Fixtures = {
  /** false にすると speechSynthesis のない端末になる */
  speech: boolean
}

export const test = base.extend<Fixtures>({
  speech: [true, { option: true }],
  page: async ({ page, speech }, use) => {
    await page.addInitScript(stubDevices, { speech })
    await use(page)
  },
})

export { expect }

// ---------- 操作 ----------

/** 連打の保護（300ms）にかからない間隔 */
export const RALLY_GAP_MS = 330

export const spoken = (page: Page) => page.evaluate(() => window.__spoken.slice())
export const spokenLangs = (page: Page) => page.evaluate(() => window.__spokenLangs.slice())
export const wakeLockCalls = (page: Page) => page.evaluate(() => window.__wakeLockCalls)

export const callOf = (page: Page) => page.getByTestId('call')
export const chip = (page: Page, id: PlayerId) => page.getByTestId(`chip-${id}`).first()

/** ホーム → 試合をはじめる → 設定を変えて → 開始 */
export async function startGame(
  page: Page,
  opts: { kind?: 'doubles' | 'singles'; scoring?: 'sideout' | 'rally'; target?: 11 | 15 | 21; first?: Team; names?: Partial<Record<PlayerId, string>> } = {},
) {
  await page.goto('./#/setup')
  const main = page.locator('main.su')
  await expect(main).toBeVisible()
  if (opts.kind) await main.getByRole('button', { name: opts.kind === 'doubles' ? 'ダブルス' : 'シングルス', exact: true }).click()
  if (opts.scoring) await main.getByRole('button', { name: opts.scoring === 'sideout' ? /^サイドアウト/ : /^ラリー/ }).click()
  if (opts.target) await main.getByRole('button', { name: `${opts.target}点`, exact: true }).click()
  if (opts.first) await main.getByRole('button', { name: `${opts.first}チーム`, exact: true }).click()
  for (const [id, name] of Object.entries(opts.names ?? {})) await page.getByTestId(`name-${id}`).fill(name ?? '')
  await page.getByTestId('setup-start').click()
  await expect(page).toHaveURL(/#\/play$/)
  await expect(callOf(page)).toBeVisible()
}

/** 勝ったチームのボタンを押し、連打の保護が切れるまで待つ */
export async function rally(page: Page, team: Team) {
  await page.getByTestId(`rally-${team}`).click()
  await page.waitForTimeout(RALLY_GAP_MS)
}

export async function rallies(page: Page, seq: string) {
  for (const ch of seq.replace(/\s/g, '')) await rally(page, ch as Team)
}

/** チームとコートの左右から、図のどの区画に立つか（未反転では A が下。ネットを向いて右） */
export function quadrantOf(team: Team, side: 'right' | 'left'): Quadrant {
  if (team === 'A') return side === 'right' ? 'BR' : 'BL'
  return side === 'right' ? 'TL' : 'TR'
}

export async function expectRole(page: Page, id: PlayerId, role: 'server' | 'receiver' | 'none') {
  await expect(chip(page, id)).toHaveAttribute('data-role', role)
}

export async function expectQuadrant(page: Page, id: PlayerId, q: Quadrant) {
  await expect(chip(page, id)).toHaveAttribute('data-quadrant', q)
}

/** すべてのチップの区画を読む */
export async function chipQuadrants(page: Page, ids: PlayerId[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  for (const id of ids) out[id] = await chip(page, id).getAttribute('data-quadrant')
  return out
}

/** 横スクロールが出ていないこと（1px までの丸めは許す）。はみ出した要素があれば名前を添える */
export async function expectNoHorizontalScroll(page: Page, label = '') {
  const r = await page.evaluate(() => {
    const client = document.documentElement.clientWidth
    const wide: string[] = []
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const b = el.getBoundingClientRect()
      if (b.width > 0 && b.right > client + 1) {
        const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''
        wide.push(`${el.tagName.toLowerCase()}${cls} (right ${Math.round(b.right)})`)
        if (wide.length >= 5) break
      }
    }
    return { scroll: document.documentElement.scrollWidth, client, body: document.body.scrollWidth, wide }
  })
  const msg = `${label} ${page.url()} scrollWidth ${r.scroll} > clientWidth ${r.client}: ${r.wide.join(', ')}`
  expect(r.scroll, msg).toBeLessThanOrEqual(r.client + 1)
  expect(r.body, msg).toBeLessThanOrEqual(r.client + 1)
}

/** 要素が画面（ビューポート）の中に収まっているか（スクロールしないで） */
export async function expectInViewport(page: Page, loc: Locator, label: string) {
  const vp = page.viewportSize()!
  const box = await loc.boundingBox()
  expect(box, `${label} has a box`).not.toBeNull()
  const b = box!
  expect(b.x, `${label} left`).toBeGreaterThanOrEqual(-1)
  expect(b.y, `${label} top`).toBeGreaterThanOrEqual(-1)
  expect(b.x + b.width, `${label} right`).toBeLessThanOrEqual(vp.width + 1)
  expect(b.y + b.height, `${label} bottom (${Math.round(b.y + b.height)} > ${vp.height})`).toBeLessThanOrEqual(vp.height + 1)
}

/** 保存されている値を読む（{v:1,data} の data） */
export function stored<T>(page: Page, key: string): Promise<T | null> {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(`pickle-call:${k}`)
    return raw ? (JSON.parse(raw).data as unknown) : null
  }, key) as Promise<T | null>
}

// ---------- 保存データの用意（画面を直接開くテスト用） ----------

export const SAMPLE_SETUP = {
  format: { kind: 'doubles', scoring: 'sideout', target: 11, winBy: 2 },
  names: { A1: 'あおい', A2: 'そら', B1: 'りく', B2: 'はな' },
  startingServer: { A: 'A1', B: 'B1' },
  firstServingTeam: 'A',
  rulesetId: 'usap-2026',
} as const

/** 画面を開き直す（保存データを書いた後に、アプリに読み直させる。ハッシュだけの移動では読み直さないため） */
export async function gotoFresh(page: Page, path: string) {
  await page.goto('about:blank')
  await page.goto(path)
}

/** 試合の途中（winners の列まで進んだ）か、決着した試合を保存しておく。履歴にも1件入れる。開くときは gotoFresh で */
export async function seedGame(page: Page, winners: string, opts: { history?: boolean } = {}) {
  await page.goto('./#/')
  await page.evaluate(
    ({ setup, winners, withHistory }) => {
      const t0 = Date.UTC(2026, 10, 7, 1, 0, 0)
      const events = Array.from(winners).map((w, i) => ({ type: 'rally', winner: w, at: t0 + (i + 1) * 20_000 }))
      const wrap = (data: unknown) => JSON.stringify({ v: 1, data })
      localStorage.setItem('pickle-call:current', wrap({ id: 'seed-1', setup, events, startedAt: t0, flipped: false }))
      localStorage.setItem('pickle-call:lastSetup', wrap(setup))
      if (withHistory) {
        localStorage.setItem(
          'pickle-call:history',
          wrap([
            {
              id: 'seed-0',
              startedAt: t0 - 3_600_000,
              endedAt: t0 - 3_000_000,
              format: setup.format,
              names: setup.names,
              score: { A: 9, B: 11 },
              winner: 'B',
              rallies: 37,
              sideOuts: 14,
              rulesetId: 'usap-2026',
            },
          ]),
        )
      }
    },
    { setup: SAMPLE_SETUP, winners, withHistory: !!opts.history },
  )
}
