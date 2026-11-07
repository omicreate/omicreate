/**
 * 点検で出た指摘の再発を防ぐ結合テスト（jsdom + fake-indexeddb）。時計は 2026-11-07 に固定する（Date だけを差し替える）。
 * 入力が黙って消えない・消した人が戻らない・二重に押しても壊れない・古い事実の文面を出さない、などを確かめる。
 */
import { IDBFactory } from 'fake-indexeddb'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createRoot } from 'react-dom/client'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { archiveCustomer, MESSAGES } from '../domain'
import {
  ACTIVE_DB_KEY,
  acknowledgeNotice,
  createPinLock,
  loadSampleData,
  openRepository,
  prepareOnStartup,
  PROD_DB,
  Repository,
  SAMPLE_DB,
  type DbName,
} from '../storage'
import { PIN_ATTEMPTS_DRAFT } from '../state/lock'
import { STALE_DRAFT_NOTE } from './screens/Koekake'

const NOW = new Date('2026-11-07T12:00:00+09:00')
const T = '2026-11-07'

vi.setConfig({ testTimeout: 30_000 })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withRepo<T>(name: DbName, fn: (repo: Repository) => Promise<T>): Promise<T> {
  const repo = await openRepository({ dbName: name })
  try {
    return await fn(repo)
  } finally {
    repo.close()
  }
}

/** サンプル用データベースに中身を入れて、そちらを開く状態にする */
async function seedSample(patch?: (repo: Repository) => Promise<void>) {
  await withRepo(SAMPLE_DB, async (repo) => {
    await loadSampleData(repo, T, NOW.toISOString())
    if (patch) await patch(repo)
  })
  localStorage.setItem(ACTIVE_DB_KEY, SAMPLE_DB)
}

/** 空の本番用データベース（S0 の［読みました］は済み） */
async function seedProd(patch?: (repo: Repository) => Promise<void>) {
  await withRepo(PROD_DB, async (repo) => {
    await prepareOnStartup(repo, { today: T, now: NOW.toISOString() })
    await acknowledgeNotice(repo, NOW.toISOString())
    if (patch) await patch(repo)
  })
  localStorage.setItem(ACTIVE_DB_KEY, PROD_DB)
}

function open(hash: string) {
  history.replaceState(null, '', hash)
  render(<App />)
}

const readDb = (name: DbName) => withRepo(name, (r) => r.loadAll())
const readDrafts = (name: DbName) => withRepo(name, (r) => r.listDrafts())

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
  sessionStorage.clear()
  history.replaceState(null, '', '#/')
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('ざっくり登録: 入力が黙って消えない（4.7・6.1）', () => {
  it('管理者を選ばずに［ホームへ］を押すと、移らずに理由を出し、下書きを残す。21文字の呼び名も止める', async () => {
    const user = userEvent.setup()
    await seedProd()
    open('#/bulk')
    await screen.findByRole('heading', { name: 'ざっくり登録' })
    await user.type(screen.getAllByLabelText('呼び名')[0], 'ひいらぎ')
    await user.type(screen.getAllByLabelText(/最終来店/)[0], '7月')
    await sleep(400)
    await user.click(screen.getByRole('button', { name: 'ホームへ' }))
    expect(await screen.findByText(/まだ保存していない行があります（1人目: データの管理者を選んでください）/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'ざっくり登録' })).toBeTruthy()
    expect((await readDb(PROD_DB)).customers).toHaveLength(0)
    const bulk = (await readDrafts(PROD_DB)).find((d) => d.formId === 'bulk')
    expect(JSON.stringify(bulk?.data)).toContain('ひいらぎ')

    // 管理者を選ぶと1行目は保存される。2行目が21文字なら、まだ移らない
    const common = screen.getByRole('heading', { name: 'この登録の共通設定' }).closest('section')!
    await user.click(within(common).getByRole('radio', { name: '本人' }))
    await user.type(screen.getAllByLabelText('呼び名')[1], 'あ'.repeat(21))
    await user.click(screen.getByRole('button', { name: /ホームへ/ }))
    expect(await screen.findByText(/2人目: 20文字までにしてください/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'ざっくり登録' })).toBeTruthy()
    expect((await readDb(PROD_DB)).customers.map((c) => c.nickname)).toEqual(['ひいらぎ'])

    // 直せば登録してホームへ
    const second = screen.getAllByLabelText('呼び名')[1]
    await user.clear(second)
    await user.type(second, 'あおい')
    await user.click(screen.getByRole('button', { name: /ホームへ/ }))
    await screen.findByRole('heading', { name: /声をかけてもよさそうな人/ })
    expect((await readDb(PROD_DB)).customers.map((c) => c.nickname).sort()).toEqual(['あおい', 'ひいらぎ'])
    expect((await readDrafts(PROD_DB)).some((d) => d.formId === 'bulk')).toBe(false)
  })

  it('行ごとの設定で管理者を空にすると、その行に理由を出す', async () => {
    const user = userEvent.setup()
    await seedProd()
    open('#/bulk')
    await screen.findByRole('heading', { name: 'ざっくり登録' })
    const row = screen.getAllByRole('listitem')[0]
    await user.type(within(row).getByLabelText('呼び名'), 'つつじ')
    await user.click(within(row).getByText('この行だけ管理者・経路を変える'))
    expect(await within(row).findByText('データの管理者を選んでください')).toBeTruthy()
  })

  it('保存の途中で［ホームへ］を二重に押しても、同じ顧客は1人だけ', async () => {
    const user = userEvent.setup()
    await seedProd()
    open('#/bulk')
    await screen.findByRole('heading', { name: 'ざっくり登録' })
    const common = screen.getByRole('heading', { name: 'この登録の共通設定' }).closest('section')!
    await user.click(within(common).getByRole('radio', { name: '本人' }))
    await user.type(screen.getAllByLabelText('呼び名')[0], 'さくら')
    await sleep(310)
    const finish = screen.getByRole('button', { name: /ホームへ/ })
    fireEvent.click(finish)
    fireEvent.click(finish)
    await screen.findByRole('heading', { name: /声をかけてもよさそうな人/ })
    await sleep(400)
    expect((await readDb(PROD_DB)).customers.filter((c) => c.nickname === 'さくら')).toHaveLength(1)
  })

  it('下書きのあとに消した顧客の行は、開き直しても作り直さない', async () => {
    await seedSample(async (repo) => {
      await repo.putDraft('bulk', {
        steward: 'salon',
        channel: 'unknown',
        rows: [{ key: 'r1', nickname: 'さざんか', lastVisit: '8月', menuIds: [], override: false, customerId: 'already-deleted' }],
      })
    })
    open('#/bulk')
    await screen.findByRole('heading', { name: 'ざっくり登録' })
    await sleep(700)
    const data = await readDb(SAMPLE_DB)
    expect(data.customers.some((c) => c.nickname === 'さざんか')).toBe(false)
    expect((screen.getAllByLabelText('呼び名')[0] as HTMLInputElement).value).toBe('')
  })
})

describe('二重に押しても、削除の取り消しが効く（6.1・AC-07）', () => {
  it('顧客カードの［削除］を素早く2回押しても、［元に戻す］で戻る', async () => {
    const user = userEvent.setup()
    await seedSample()
    open('#/customer/sample-tsubaki')
    const del = await screen.findByRole('button', { name: '削除' })
    fireEvent.click(del)
    fireEvent.click(del)
    await user.click(await screen.findByRole('button', { name: '元に戻す' }))
    await waitFor(async () => {
      const data = await readDb(SAMPLE_DB)
      expect(data.customers.find((c) => c.id === 'sample-tsubaki')?.deletedAt).toBeUndefined()
      expect(data.visits.filter((v) => v.customerId === 'sample-tsubaki')).toHaveLength(3)
    })
  })

  it('来店記録の［この来店記録を削除］を素早く2回押しても、［元に戻す］で戻る', async () => {
    const user = userEvent.setup()
    await seedSample()
    open('#/visit/sample-yuzu-v4')
    const del = await screen.findByRole('button', { name: 'この来店記録を削除' })
    fireEvent.click(del)
    fireEvent.click(del)
    await user.click(await screen.findByRole('button', { name: '元に戻す' }))
    await waitFor(async () => {
      const v = (await readDb(SAMPLE_DB)).visits.find((x) => x.id === 'sample-yuzu-v4')
      expect(v).toBeTruthy()
      expect(v?.deletedAt).toBeUndefined()
    })
  })

  it('［今回は見送る］の選択肢を二重に押しても、見送りは1回だけ数える', async () => {
    await seedSample()
    open('#/koekake/sample-yuzu')
    fireEvent.click(await screen.findByRole('button', { name: '今回は見送る' }))
    const sheet = await screen.findByRole('dialog', { name: '今回は見送る' })
    const two = within(sheet).getByRole('button', { name: '2週間' })
    fireEvent.click(two)
    fireEvent.click(two)
    await screen.findByRole('heading', { name: /声をかけてもよさそうな人/ })
    await sleep(100)
    expect((await readDb(SAMPLE_DB)).counters?.koekakeSkipped).toBe(1)
  })
})

describe('声かけの下書きは、事実が変わったら戻さない（0.3 #2・4.5・7.3）', () => {
  async function editYuzuText(user: ReturnType<typeof userEvent.setup>) {
    open('#/koekake/sample-yuzu')
    const ta = (await screen.findByLabelText('文面')) as HTMLTextAreaElement
    await user.type(ta, 'よろしく')
    await sleep(450)
    cleanup()
  }

  it('同じ日に開き直すと、手直しした文面が戻る', async () => {
    const user = userEvent.setup()
    await seedSample()
    await editYuzuText(user)
    open('#/koekake/sample-yuzu')
    const ta = (await screen.findByLabelText('文面')) as HTMLTextAreaElement
    await waitFor(() => expect(ta.value).toContain('よろしく'))
  })

  it('管理者を「所属サロン」に変えたあとは、自分用の予約リンク入りの下書きを出さない', async () => {
    const user = userEvent.setup()
    await seedSample()
    await editYuzuText(user)
    await withRepo(SAMPLE_DB, async (repo) => {
      const c = (await repo.getCustomer('sample-yuzu'))!
      await repo.putCustomer({ ...c, stewardship: { steward: 'salon', channel: 'salon_media', decidedOn: T } })
    })
    open('#/koekake/sample-yuzu?from=card')
    await user.click(await screen.findByRole('button', { name: '認められているので続ける' }))
    const ta = (await screen.findByLabelText('文面')) as HTMLTextAreaElement
    await sleep(100)
    expect(ta.value).not.toContain('example.com/booking')
    expect(ta.value).not.toContain('よろしく')
    expect(screen.getByText(STALE_DRAFT_NOTE)).toBeTruthy()
    await waitFor(async () => expect((await readDrafts(SAMPLE_DB)).some((d) => d.formId === 'koekake:sample-yuzu')).toBe(false))
  })

  it('日をまたいで経過が変わったら、古い「経過」の下書きを出さない', async () => {
    const user = userEvent.setup()
    await seedSample()
    await editYuzuText(user)
    vi.setSystemTime(new Date('2026-12-19T12:00:00+09:00'))
    open('#/koekake/sample-yuzu')
    const ta = (await screen.findByLabelText('文面')) as HTMLTextAreaElement
    await sleep(100)
    expect(ta.value).toContain('4か月ほどたちましたが')
    expect(ta.value).not.toContain('2か月半')
    expect(ta.value).not.toContain('よろしく')
  })
})

describe('来店記録の下書きと日付（6.1・AC-05）', () => {
  it('日をまたいだ下書きは、日付を今日に置き直して戻し、そのことを出す', async () => {
    const user = userEvent.setup()
    await seedSample()
    open('#/visit?c=sample-momiji&same=1')
    await user.click(await screen.findByRole('button', { name: '6週' }))
    await sleep(450)
    cleanup()
    vi.setSystemTime(new Date('2026-12-19T12:00:00+09:00'))
    open('#/visit?c=sample-momiji&same=1')
    await screen.findByText(/11月7日に入力していた内容を戻しました/)
    expect((screen.getByLabelText('日付') as HTMLInputElement).value).toBe('2026-12-19')
    expect(screen.getByRole('button', { name: '6週' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('来た？の［来た］（予約日つき）で開くと、同じ日の下書きがあっても予約日を使う', async () => {
    const user = userEvent.setup()
    await seedSample()
    open('#/visit?c=sample-suzuran&same=1')
    await user.click(await screen.findByRole('button', { name: /くわしく/ }))
    await user.type(screen.getByLabelText('会話メモ'), '散歩の話')
    await sleep(450)
    cleanup()
    open('#/visit?c=sample-suzuran&same=1&date=2026-11-04')
    await screen.findByText('入力途中の内容を戻しました')
    expect((screen.getByLabelText('日付') as HTMLInputElement).value).toBe('2026-11-04')
  })

  it('日付欄が空でも［読み取る］で客とメニューが入る', async () => {
    const user = userEvent.setup()
    await seedSample()
    open('#/visit')
    await screen.findByRole('heading', { name: '来店を記録' })
    fireEvent.change(screen.getByLabelText('日付'), { target: { value: '' } })
    await user.type(screen.getByLabelText(/1行で入れる/), 'ゆず カット 6週')
    await user.click(screen.getByRole('button', { name: '読み取る' }))
    const who = screen.getByRole('region', { name: 'お客様' })
    expect(within(who).getByText('ゆず')).toBeTruthy()
    expect(screen.getByRole('button', { name: '6週' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('客が決まった状態で開くと、1行入力は折りたたまれ、次回のチップがメニューより上にある', async () => {
    await seedSample()
    open('#/visit?c=sample-momiji&same=1')
    await screen.findByRole('heading', { name: '来店を記録' })
    expect(screen.getByRole('button', { name: /1行で入れる/ }).getAttribute('aria-expanded')).toBe('false')
    const next = screen.getByRole('group', { name: '次回' })
    const menu = screen.getByRole('group', { name: 'メニュー' })
    expect(next.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('リストから外した客（4.3・4.6）', () => {
  it('まとめ記録で［来た］にすると、リストに戻し「リストに戻しました」と出す', async () => {
    const user = userEvent.setup()
    await seedSample(async (repo) => {
      const c = (await repo.getCustomer('sample-yuzu'))!
      await repo.putCustomer(archiveCustomer(c, 'moved', { today: T, now: NOW.toISOString() }))
    })
    open('#/batch')
    await screen.findByRole('heading', { name: '閉店後のまとめ記録' })
    await user.click(screen.getByRole('button', { name: '＋人を足す' }))
    const sheet = await screen.findByRole('dialog', { name: '人を足す' })
    await user.type(within(sheet).getByLabelText('お客様'), 'ゆず')
    await user.click(within(sheet).getByRole('button', { name: 'ゆず' }))
    await user.click(screen.getByRole('button', { name: 'まとめて保存' }))
    expect(await screen.findByText('1人をリストに戻しました')).toBeTruthy()
    const data = await readDb(SAMPLE_DB)
    expect(data.customers.find((c) => c.id === 'sample-yuzu')?.archived).toBeUndefined()
    expect(data.visits.some((v) => v.customerId === 'sample-yuzu' && v.date === T && v.source === 'batch')).toBe(true)
  })

  it('過去の来店記録を直しただけでは、リストから外した客は戻らない', async () => {
    const user = userEvent.setup()
    await seedSample(async (repo) => {
      const c = (await repo.getCustomer('sample-yuzu'))!
      await repo.putCustomer(archiveCustomer(c, 'moved', { today: T, now: NOW.toISOString() }))
    })
    open('#/visit/sample-yuzu-v4')
    await screen.findByRole('heading', { name: '来店記録を直す' })
    await user.click(screen.getByRole('button', { name: /くわしく/ }))
    await user.type(screen.getByLabelText('会話メモ'), '追記')
    await user.click(screen.getByRole('button', { name: '保存' }))
    await screen.findByText('来店記録を直しました')
    expect(screen.queryByText('リストに戻しました')).toBeNull()
    const c = (await readDb(SAMPLE_DB)).customers.find((x) => x.id === 'sample-yuzu')!
    expect(c.archived).toEqual({ on: T, reason: 'moved' })
  })
})

describe('保存の失敗を知らせる（4.3・4.6）', () => {
  it('［送った］の保存に失敗したら知らせ、もう一度押せる', async () => {
    const user = userEvent.setup()
    await seedSample()
    vi.spyOn(Repository.prototype, 'putContact').mockRejectedValueOnce(new Error('QuotaExceededError'))
    open('#/koekake/sample-yuzu')
    await screen.findByRole('heading', { name: 'ゆず' })
    await user.click(screen.getByRole('button', { name: 'コピー' }))
    await user.click(await screen.findByRole('button', { name: '送った' }))
    expect(await screen.findByText(MESSAGES.saveFailed)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'ゆず' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '送った' }))
    await screen.findByRole('heading', { name: /声をかけてもよさそうな人/ })
    expect((await readDb(SAMPLE_DB)).contacts.filter((c) => c.customerId === 'sample-yuzu')).toHaveLength(1)
  })

  it('「送りましたか？」を出したら、見える位置まで送る', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy
    try {
      await seedSample()
      open('#/koekake/sample-yuzu')
      await screen.findByRole('heading', { name: 'ゆず' })
      await user.click(screen.getByRole('button', { name: 'コピー' }))
      await screen.findByText('送りましたか？')
      expect(spy).toHaveBeenCalledWith({ block: 'nearest' })
    } finally {
      delete (Element.prototype as Partial<Element>).scrollIntoView
    }
  })
})

describe('連絡の同意の記録（5.1・7.3）', () => {
  it('［今回は見送る］→［連絡しないにする］は本人に確かめた記録にせず、顧客カードにそう出す', async () => {
    const user = userEvent.setup()
    await seedSample()
    open('#/koekake/sample-yuzu')
    await user.click(await screen.findByRole('button', { name: '今回は見送る' }))
    await user.click(within(await screen.findByRole('dialog', { name: '今回は見送る' })).getByRole('button', { name: '連絡しないにする' }))
    await screen.findByRole('heading', { name: /声をかけてもよさそうな人/ })
    const c = (await readDb(SAMPLE_DB)).customers.find((x) => x.id === 'sample-yuzu')!
    expect(c.contact).toEqual({ permission: 'no' })
    cleanup()
    open('#/customer/sample-yuzu')
    expect(await screen.findByText('本人には確かめていません（美容師の判断）')).toBeTruthy()
  })

  it('顧客カードの編集で、確かめた方法（メッセージの返事）を残せて、確かめた日と一緒に出る', async () => {
    const user = userEvent.setup()
    await seedSample()
    open('#/customer/sample-tsubaki')
    await user.click(await screen.findByRole('button', { name: '編集' }))
    const editor = screen.getByRole('heading', { name: '編集' }).closest('section')!
    await user.click(within(editor).getByRole('radio', { name: 'OK' }))
    await user.click(within(editor).getByRole('radio', { name: 'メッセージの返事で' }))
    await waitFor(async () => {
      const c = (await readDb(SAMPLE_DB)).customers.find((x) => x.id === 'sample-tsubaki')!
      expect(c.contact).toEqual({ permission: 'ok', confirmedOn: T, method: 'message' })
    })
    expect(await screen.findByText('連絡OKを確かめた日 2026-11-07（土）（メッセージの返事で）')).toBeTruthy()
  })
})

describe('連絡の同意の記録（ほかの欄の編集）', () => {
  it('顧客カードでかなを直しても、確かめた日・方法は変わらない', async () => {
    const user = userEvent.setup()
    await seedSample()
    const before = (await readDb(SAMPLE_DB)).customers.find((x) => x.id === 'sample-yuzu')!.contact
    open('#/customer/sample-yuzu')
    await user.click(await screen.findByRole('button', { name: '編集' }))
    const kana = screen.getByLabelText('かな（検索用）')
    await user.clear(kana)
    await user.type(kana, 'ゆずこ')
    await waitFor(async () => expect((await readDb(SAMPLE_DB)).customers.find((x) => x.id === 'sample-yuzu')?.kana).toBe('ゆずこ'))
    expect((await readDb(SAMPLE_DB)).customers.find((x) => x.id === 'sample-yuzu')!.contact).toEqual(before)
  })
})

describe('設定とサンプルから本番へ', () => {
  it('ボードの比較期間（仮の値60日）を設定で変えられる', async () => {
    const user = userEvent.setup()
    await seedSample()
    open('#/settings/thresholds')
    const input = await screen.findByLabelText('ボードで声かけと戻りを比べる期間')
    await user.clear(input)
    await user.type(input, '30')
    await waitFor(async () => expect((await readDb(SAMPLE_DB)).settings?.compareWindowDays).toBe(30))
    cleanup()
    open('#/board')
    expect(await screen.findByText(/声かけと戻り（直近30日）/)).toBeTruthy()
  })

  it('［サンプルを消して自分のお客様で始める］で永続保存を求め、名前と予約リンクの設定を案内する', async () => {
    const user = userEvent.setup()
    const persist = vi.fn(async () => true)
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist, persisted: vi.fn(async () => false) },
    })
    try {
      await seedProd()
      await seedSample()
      open('#/settings/sample')
      await user.click(await screen.findByRole('button', { name: 'サンプルを消して自分のお客様で始める' }))
      await screen.findByText(/まずはお客様をざっくり登録しましょう/)
      await waitFor(() => expect(persist).toHaveBeenCalled())
      expect(screen.getByRole('link', { name: '自分の名前と予約リンクを設定する' }).getAttribute('href')).toBe('#/settings/me')
    } finally {
      delete (navigator as { storage?: unknown }).storage
    }
  })
})

describe('画面ロック（4.11・7.4）', () => {
  async function seedLocked() {
    const lock = await createPinLock('1234', { autoLockMinutes: 5 })
    await seedSample(async (repo) => {
      await repo.updateSettings((s) => ({ ...s, lock }))
    })
  }

  it('開いたとき、ロック画面より先に呼び名入りの画面が DOM に描かれない', async () => {
    await seedLocked()
    const leaks: string[] = []
    const check = () => {
      const app = document.querySelector('.app')
      if (app?.textContent?.includes('ゆず') && !document.querySelector('.lock')) leaks.push('leak')
    }
    const mo = new MutationObserver(check)
    mo.observe(document.body, { childList: true, subtree: true, characterData: true })
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const prevAct = g.IS_REACT_ACT_ENVIRONMENT
    // act を使わずに描く（実際の描画の順番で確かめる）
    g.IS_REACT_ACT_ENVIRONMENT = false
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      history.replaceState(null, '', '#/')
      root.render(<App />)
      await waitFor(() => expect(document.querySelector('.lock')).toBeTruthy(), { timeout: 5000 })
      await waitFor(() => expect(document.querySelector('.app')?.textContent).toContain('ゆず'), { timeout: 5000 })
      check()
      expect(leaks).toEqual([])
    } finally {
      mo.disconnect()
      root.unmount()
      container.remove()
      g.IS_REACT_ACT_ENVIRONMENT = prevAct
    }
  })

  it('5回続けて間違えたあとの30秒待ちは、開き直しても続く', async () => {
    const user = userEvent.setup()
    await seedLocked()
    open('#/')
    const lock = await screen.findByRole('dialog', { name: 'またね帳' }, { timeout: 5000 })
    const input = within(lock).getByLabelText('PIN') as HTMLInputElement
    await waitFor(() => expect(input.disabled).toBe(false))
    for (let i = 0; i < 5; i++) {
      await user.type(input, '9999')
      await user.click(within(lock).getByRole('button', { name: '解除' }))
      await waitFor(() => expect(input.value).toBe(''))
    }
    expect(await within(lock).findByText(/秒入力できません/)).toBeTruthy()
    await waitFor(async () => expect((await readDrafts(SAMPLE_DB)).some((d) => d.formId === PIN_ATTEMPTS_DRAFT)).toBe(true))
    cleanup()

    open('#/')
    const again = await screen.findByRole('dialog', { name: 'またね帳' }, { timeout: 5000 })
    expect(await within(again).findByText(/秒入力できません/)).toBeTruthy()
    expect((within(again).getByLabelText('PIN') as HTMLInputElement).disabled).toBe(true)
  })
})
