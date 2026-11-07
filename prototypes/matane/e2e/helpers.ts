/**
 * 受け入れテスト（仕様 9章）の共通の道具。
 * - 時計は 2026-11-07 10:00（日本時間）に固定してから開く
 * - サンプルは初回画面の［サンプルで試す］から入れる（テストごとに新しいコンテキストなので IndexedDB は空から）
 * - IndexedDB の中身は、ページの中から読み取り専用で開いて確かめる
 */
import { expect, type Locator, type Page } from '@playwright/test'

export const NOW = new Date('2026-11-07T10:00:00+09:00')

export const SAMPLE_DB = 'matane-sample'
export const PROD_DB = 'matane'

/** サンプル 10人の呼び名（8.1） */
export const SAMPLE_NAMES = ['もみじ', 'すずらん', 'かりん', 'ゆず', 'つばき', 'なずな', 'あんず', 'こむぎ', 'わかば', 'ひいらぎ'] as const

/** 8.3 のゆずの声かけ文面 */
export const YUZU_TEXT = [
  'ゆずさん、こんにちは。',
  '美容師のサンプル美容師です。',
  '前回のカットと白髪染めから2か月半ほどたちましたが、髪の調子はいかがですか？',
  'ご予約はこちらからどうぞ。 https://example.com/booking',
  '気になることがあれば、このままお返事ください。',
].join('\n')

export const LINE_SHARE_PREFIX = 'https://line.me/R/share?text='

/** 時計を固定して開く（初回画面が出るまで待つ） */
export async function openApp(page: Page, time: Date = NOW): Promise<void> {
  await page.clock.install({ time })
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'サンプルで試す' })).toBeVisible()
}

/** 初回画面で［読みました］→［サンプルで試す］ */
export async function startSample(page: Page): Promise<void> {
  await openApp(page)
  await page.getByLabel('読みました').check()
  await page.getByRole('button', { name: 'サンプルで試す' }).click()
  await expect(page.getByRole('heading', { name: /声をかけてもよさそうな人/ })).toBeVisible()
  await expect(page.getByRole('note').filter({ hasText: 'サンプル表示中' })).toBeVisible()
}

/** ホームの「声をかけてもよさそうな人」のカード（表示順の呼び名） */
export async function candidateNames(page: Page): Promise<string[]> {
  const section = homeSection(page, /声をかけてもよさそうな人/)
  await expect(section).toBeVisible()
  return section.getByRole('article').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
}

/** ホームの見出しで区切られたセクション */
export function homeSection(page: Page, heading: RegExp | string): Locator {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: heading }) })
}

/** 下のタブ */
export async function tab(page: Page, name: 'ホーム' | 'お客様' | 'ボード' | '設定'): Promise<void> {
  await page.getByRole('navigation', { name: '画面の切り替え' }).getByRole('link', { name }).click()
}

/** 設定の小さな画面を開く */
export async function openSettings(page: Page, section: string): Promise<void> {
  await tab(page, '設定')
  await page.getByRole('link', { name: new RegExp(`^${section}`) }).click()
  await expect(page.getByRole('heading', { name: section, level: 1 })).toBeVisible()
}

/** お客様一覧から顧客カードを開く */
export async function openCustomer(page: Page, nickname: string): Promise<void> {
  await tab(page, 'お客様')
  await page.getByRole('list', { name: 'お客様の一覧' }).getByRole('link').filter({ hasText: nickname }).first().click()
  await expect(page.getByRole('heading', { name: nickname, level: 1 })).toBeVisible()
}

export type DbDump = Record<string, any[]>

/**
 * IndexedDB の中身を読む（ストアごとの配列）。データベースがなければ null。
 * 新しく作ってしまわないよう、作り直しが起きたら中止する。
 */
export async function readDb(page: Page, name: string): Promise<DbDump | null> {
  return page.evaluate(async (dbName) => {
    const list = await indexedDB.databases()
    if (!list.some((d) => d.name === dbName)) return null
    const db = await new Promise<IDBDatabase | null>((resolve) => {
      const req = indexedDB.open(dbName)
      req.onupgradeneeded = () => req.transaction?.abort()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    })
    if (!db) return null
    try {
      const out: Record<string, unknown[]> = {}
      for (const store of Array.from(db.objectStoreNames)) {
        out[store] = await new Promise<unknown[]>((resolve, reject) => {
          const rq = db.transaction(store, 'readonly').objectStore(store).getAll()
          rq.onsuccess = () => resolve(rq.result)
          rq.onerror = () => reject(rq.error)
        })
      }
      return out
    } finally {
      db.close()
    }
  }, name)
}

/** データベースの名前の一覧 */
export async function dbNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name ?? ''))
}

/** 条件を満たすまで IndexedDB を読み直す */
export async function waitForDb(page: Page, name: string, check: (db: DbDump) => boolean, message = 'IndexedDB の中身'): Promise<DbDump> {
  let last: DbDump | null = null
  await expect
    .poll(
      async () => {
        last = await readDb(page, name)
        return !!last && check(last)
      },
      { message, timeout: 10_000 },
    )
    .toBe(true)
  return last!
}

/** 削除印のない記録だけ */
export function alive<T extends { deletedAt?: string }>(rows: T[] | undefined): T[] {
  return (rows ?? []).filter((r) => !r.deletedAt)
}

/** クリップボードの中身（コンテキストに clipboard-read の権限が要る） */
export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText())
}

/** ページの中の見えている文字（画面に出ているものだけ） */
export async function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText)
}

/** アプリを離れた／戻ったことにする（visibilitychange を起こす） */
export async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}
