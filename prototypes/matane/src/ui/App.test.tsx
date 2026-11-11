/**
 * 画面の結合テスト（jsdom + fake-indexeddb）。時計は 2026-11-07 に固定する（Date だけを差し替え、タイマーは本物）。
 * 受け入れ条件（仕様 9）のうち、画面で確かめられるものを先に押さえる。
 */
import { IDBFactory } from 'fake-indexeddb'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { openRepository, SAMPLE_DB, PROD_DB } from '../storage'

const NOW = new Date('2026-11-07T12:00:00+09:00')

// jsdom で役割（role）を探すのは遅いので、1つのテストの持ち時間を長めにする
vi.setConfig({ testTimeout: 30_000 })

const YUZU_TEXT = [
  'ゆずさん、こんにちは。',
  '美容師のサンプル美容師です。',
  '前回のカットと白髪染めから2か月半ほどたちましたが、髪の調子はいかがですか？',
  'ご予約はこちらからどうぞ。 https://example.com/booking',
  '気になることがあれば、このままお返事ください。',
].join('\n')

function go(hash: string) {
  window.location.hash = hash
}

async function startSample(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(await screen.findByLabelText('読みました'))
  await user.click(screen.getByRole('button', { name: 'サンプルで試す' }))
  await screen.findByRole('heading', { name: /声をかけてもよさそうな人/ }, { timeout: 5000 })
}

async function readDb(name: typeof SAMPLE_DB | typeof PROD_DB) {
  const repo = await openRepository({ dbName: name })
  try {
    return await repo.loadAll()
  } finally {
    repo.close()
  }
}

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
  vi.useRealTimers()
})

describe('S0 はじめに', () => {
  it('［読みました］にチェックするまでボタンは押せない', async () => {
    render(<App />)
    const own = await screen.findByRole('button', { name: '自分のお客様で始める' })
    expect((own as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'サンプルで試す' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/カルテの代わりではありません/)).toBeTruthy()
    await userEvent.setup().click(screen.getByLabelText('読みました'))
    expect((own as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('S1 ホーム（AC-01）', () => {
  it('サンプルで、今日のお客様・来た？・候補の順・要約が 8.3 のとおりに出る', async () => {
    const user = userEvent.setup()
    await startSample(user)
    expect(screen.getByRole('note').textContent).toBe('サンプル表示中')
    const today = screen.getByRole('heading', { name: /今日のお客様/ }).closest('section')!
    expect(within(today).getByText('もみじ')).toBeTruthy()
    const confirm = screen.getByRole('heading', { name: /来た？の確認/ }).closest('section')!
    expect(within(confirm).getByText('すずらん')).toBeTruthy()
    expect(within(confirm).getByText('予約 11月4日（水）')).toBeTruthy()
    const cands = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))
    expect(cands).toEqual(['つばき', 'ゆず', 'ひいらぎ', 'かりん'])
    const hiiragi = screen.getByRole('article', { name: 'ひいらぎ' })
    expect(within(hiiragi).getByText('最終来店はおおよそ')).toBeTruthy()
    expect(within(hiiragi).getByText('連絡OKは未確認')).toBeTruthy()
    expect(screen.getByText('所属サロンの顧客 1人・連絡しない 1人・声をかけてから30日以内 1人は出していません')).toBeTruthy()
    expect(screen.queryByText(/記録が止まっています/)).toBeNull()
  })
})

describe('S2 来店記録（AC-05・AC-06・AC-16）', () => {
  it('もみじの［来た］→［6週］→［保存］でまたねカードに「12月中旬ごろ」と予約リンクが入り、記録済みになる', async () => {
    const user = userEvent.setup()
    await startSample(user)
    await user.click(screen.getByRole('link', { name: 'もみじさん 来た' }))
    await screen.findByRole('heading', { name: '来店を記録' })
    await user.click(screen.getByRole('button', { name: '6週' }))
    await user.click(screen.getByRole('button', { name: '保存' }))
    const sheet = await screen.findByRole('dialog', { name: 'またねカード' })
    const text = (within(sheet).getByRole('textbox') as HTMLTextAreaElement).value
    expect(text).toContain('次回の目安：12月中旬ごろ')
    expect(text).toContain('今日のメニュー：カットと白髪染め')
    expect(text).toContain('https://example.com/booking')
    await user.click(within(sheet).getByRole('button', { name: '送らない' }))
    await screen.findByText('記録済み')
    const data = await readDb(SAMPLE_DB)
    const v = data.visits.find((x) => x.customerId === 'sample-momiji' && x.date === '2026-11-07')!
    expect(v.menuIds.sort()).toEqual(['cut', 'gray'])
    expect(v.next).toEqual({ kind: 'agreed', amount: 6, unit: 'week' })
  })

  it('会話メモの下書きは開き直すと戻り、［保存］のあとは残らない。健康語には注意が出る', async () => {
    const user = userEvent.setup()
    await startSample(user)
    go('#/visit?c=sample-yuzu')
    await screen.findByRole('heading', { name: '来店を記録' })
    await user.click(screen.getByRole('button', { name: /くわしく/ }))
    await user.type(screen.getByLabelText('会話メモ'), '頭皮にアレルギーあり')
    expect(await screen.findByText(/健康に関することは書かないでください/)).toBeTruthy()
    await new Promise((r) => setTimeout(r, 500))
    cleanup()

    render(<App />)
    const memo = (await screen.findByLabelText('会話メモ', {}, { timeout: 5000 })) as HTMLTextAreaElement
    await waitFor(() => expect(memo.value).toBe('頭皮にアレルギーあり'))
    expect(screen.getByText('入力途中の内容を戻しました')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'カット' }))
    await user.click(screen.getByRole('button', { name: '保存' }))
    const sheet = await screen.findByRole('dialog', { name: 'またねカード' })
    expect((within(sheet).getByRole('textbox') as HTMLTextAreaElement).value).not.toContain('アレルギー')
    await user.click(within(sheet).getByRole('button', { name: '送らない' }))
    // 戻る先を指定していないときは顧客カードへ戻る
    await screen.findByRole('heading', { name: 'ゆず' })
    cleanup()

    go('#/visit?c=sample-yuzu')
    render(<App />)
    await screen.findByRole('heading', { name: '来店を記録' }, { timeout: 5000 })
    await new Promise((r) => setTimeout(r, 200))
    expect(screen.queryByText('入力途中の内容を戻しました')).toBeNull()
  })

  it('メニューを選ばずに保存すると止まる。未来の日付も止まる', async () => {
    const user = userEvent.setup()
    await startSample(user)
    go('#/visit?c=sample-yuzu')
    await screen.findByRole('heading', { name: '来店を記録' })
    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText('メニューを1つ選んでください')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('S4 声かけ（AC-02・AC-04・AC-10）', () => {
  it('ゆずの文面が 8.3 と一致し、LINE のリンクをデコードすると文面と同じ', async () => {
    const user = userEvent.setup()
    await startSample(user)
    go('#/koekake/sample-yuzu')
    await screen.findByRole('heading', { name: 'ゆず' })
    expect(screen.getByText('いつもは約8週ごと → 今回は11週')).toBeTruthy()
    expect(screen.getByText('2026-08-22（土）')).toBeTruthy()
    const ta = screen.getByLabelText('文面') as HTMLTextAreaElement
    expect(ta.value).toBe(YUZU_TEXT)
    for (const w of ['割引', 'OFF', 'クーポン', '%']) expect(ta.value).not.toContain(w)
    expect(ta.value).not.toContain('受験')
    const line = screen.getByRole('button', { name: 'LINEで送る' })
    const href = line.getAttribute('href')!
    expect(href.startsWith('https://line.me/R/share?text=')).toBe(true)
    expect(decodeURIComponent(href.slice('https://line.me/R/share?text='.length))).toBe(ta.value)
  })

  it('［送った］で声かけの記録ができ、候補から外れる', async () => {
    const user = userEvent.setup()
    await startSample(user)
    go('#/koekake/sample-yuzu')
    await screen.findByRole('heading', { name: 'ゆず' })
    await user.click(screen.getByRole('button', { name: 'コピー' }))
    await user.click(await screen.findByRole('button', { name: '送った' }))
    await screen.findByRole('heading', { name: /声をかけてもよさそうな人/ })
    await waitFor(() => expect(screen.queryByRole('article', { name: 'ゆず' })).toBeNull())
    const data = await readDb(SAMPLE_DB)
    const logs = data.contacts.filter((c) => c.customerId === 'sample-yuzu' && c.kind === 'koekake')
    expect(logs).toHaveLength(1)
    expect(logs[0].via).toBe('copy')
    expect(data.counters?.koekakeSent).toBe(3)
  })

  it('所属サロンの顧客は注意を確認するまで文面に進めず、予約リンクの行が消え、記録に確認済みが残る', async () => {
    const user = userEvent.setup()
    await startSample(user)
    go('#/koekake/sample-anzu?from=card')
    await screen.findByRole('heading', { name: 'あんず' })
    expect(screen.getByText(/この方のデータの管理者は所属サロンです/)).toBeTruthy()
    expect(screen.queryByLabelText('文面')).toBeNull()
    expect(screen.queryByRole('button', { name: 'LINEで送る' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '認められているので続ける' }))
    const ta = (await screen.findByLabelText('文面')) as HTMLTextAreaElement
    expect(ta.value).not.toContain('example.com')
    expect(ta.value).not.toContain('ご予約はこちらから')
    await user.click(screen.getByRole('button', { name: 'コピー' }))
    await user.click(await screen.findByRole('button', { name: '送った' }))
    await screen.findByRole('heading', { name: 'あんず' })
    const data = await readDb(SAMPLE_DB)
    const log = data.contacts.find((c) => c.customerId === 'sample-anzu' && c.kind === 'koekake')!
    expect(log.stewardWarningAcked).toBe(true)
  })

  it('［実は来ていた］で 2026-11-01 を保存すると「リストから外れました」と出てホームに戻り、候補が3人になる（AC-03）', async () => {
    const user = userEvent.setup()
    await startSample(user)
    go('#/koekake/sample-yuzu')
    await screen.findByRole('heading', { name: 'ゆず' })
    await user.click(screen.getByRole('link', { name: '実は来ていた → 来店を追加' }))
    await screen.findByRole('heading', { name: '来店を追加' })
    fireEvent.change(screen.getByLabelText('日付'), { target: { value: '2026-11-01' } })
    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText('リストから外れました')).toBeTruthy()
    await screen.findByRole('heading', { name: /声をかけてもよさそうな人/ })
    await waitFor(() => expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['つばき', 'ひいらぎ', 'かりん']))
    const data = await readDb(SAMPLE_DB)
    expect(data.counters?.actuallyVisitedFixes).toBe(1)
  })
})

describe('S5 顧客カード・削除の取り消し（AC-07）', () => {
  it('来店記録を削除して［元に戻す］を押すと記録が戻る', async () => {
    const user = userEvent.setup()
    await startSample(user)
    go('#/visit/sample-yuzu-v4')
    await screen.findByRole('heading', { name: '来店記録を直す' })
    await user.click(screen.getByRole('button', { name: 'この来店記録を削除' }))
    await screen.findByRole('heading', { name: 'ゆず' })
    expect(await screen.findByText('来店記録を削除しました')).toBeTruthy()
    const visitsList = () => screen.getByRole('heading', { name: '直近の来店' }).closest('section')!
    expect(within(visitsList()).queryByText('2026-08-22（土）')).toBeNull()
    await user.click(screen.getByRole('button', { name: '元に戻す' }))
    await waitFor(() => expect(within(visitsList()).getByText('2026-08-22（土）')).toBeTruthy())
    const data = await readDb(SAMPLE_DB)
    expect(data.visits.find((v) => v.id === 'sample-yuzu-v4')?.deletedAt).toBeUndefined()
  })
})

describe('S6 ざっくり登録（AC-11）', () => {
  it('経路でサロン媒体を選ぶと管理者が所属サロンになり、本人に戻して「ひいらぎ／7月／縮毛矯正」を入れるとホームの候補に出る', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByLabelText('読みました'))
    await user.click(screen.getByRole('button', { name: '自分のお客様で始める' }))
    await user.click(await screen.findByRole('button', { name: '次へ' }))
    await screen.findByRole('heading', { name: '予約リンク' })
    await user.click(screen.getByRole('button', { name: '次へ' }))
    await user.click(await screen.findByRole('button', { name: 'ざっくり登録へ' }))
    await screen.findByRole('heading', { name: 'ざっくり登録' })

    const common = screen.getByRole('heading', { name: 'この登録の共通設定' }).closest('section')!
    await user.selectOptions(within(common).getByLabelText('獲得経路'), 'salon_media')
    expect(within(common).getByRole('radio', { name: '所属サロン' }).getAttribute('aria-checked')).toBe('true')
    await user.click(within(common).getByRole('radio', { name: '本人' }))

    await user.type(screen.getAllByLabelText('呼び名')[0], 'ひいらぎ')
    await user.type(screen.getAllByLabelText(/最終来店/)[0], '7月')
    const row = screen.getAllByRole('listitem')[0]
    await user.click(within(row).getByRole('button', { name: '縮毛矯正' }))
    await within(row).findByText('保存しました', {}, { timeout: 3000 })
    expect(within(row).getByText('2026-07-31（おおよそ）')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /ホームへ/ }))
    const card = await screen.findByRole('article', { name: 'ひいらぎ' })
    expect(within(card).getByText('最終来店はおおよそ')).toBeTruthy()
    const data = await readDb(PROD_DB)
    const v = data.visits[0]
    expect(v).toMatchObject({ date: '2026-07-31', dateApprox: 'month', source: 'bulk', menuIds: ['straight'] })
    expect(data.customers[0].stewardship.channel).toBe('salon_media')
    expect(data.customers[0].stewardship.steward).toBe('self')
  })

  it('最終来店が読めないときは注意を出し、来店なしで保存する', async () => {
    const user = userEvent.setup()
    await startSample(user)
    go('#/bulk')
    await screen.findByRole('heading', { name: 'ざっくり登録' })
    await user.click(screen.getByRole('radio', { name: '本人' }))
    await user.type(screen.getAllByLabelText('呼び名')[0], 'さくら')
    await user.type(screen.getAllByLabelText(/最終来店/)[0], '13月')
    expect(await screen.findByText('読み取れませんでした（例: 8月、2026-08、8/22）')).toBeTruthy()
    await screen.findAllByText('保存しました', {}, { timeout: 3000 })
    const data = await readDb(SAMPLE_DB)
    const c = data.customers.find((x) => x.nickname === 'さくら')!
    expect(data.visits.some((v) => v.customerId === c.id)).toBe(false)
  })
})

describe('S7 ボード（AC-17）', () => {
  it('数字が 8.3 と一致し、円と%が出ない', async () => {
    const user = userEvent.setup()
    await startSample(user)
    go('#/board')
    await screen.findByRole('heading', { name: 'わたしの再来ボード' })
    const main = screen.getByRole('main')
    const text = main.textContent ?? ''
    expect(within(main).getByRole('region', { name: '稼働顧客数' }).textContent).toContain('10人')
    expect(text).toContain('先月末 9人')
    expect(text).toContain('今月 1件中1件')
    expect(text).toContain('（目安1）')
    expect(text).toContain('先月 1件中1件（予約1）')
    expect(text).toContain('声かけした人 2人 → その後来店 1人')
    expect(text).toContain('声かけしなかったご無沙汰の人 2人 → その後来店 1人')
    expect(text).not.toContain('円')
    expect(text).not.toContain('%')
  })
})

describe('S9 ロック（AC-18）', () => {
  it('PIN を設定して今すぐロックすると、5回間違えたあとは入力できない。正しいPINで解除できる', async () => {
    const user = userEvent.setup()
    await startSample(user)
    go('#/settings/lock')
    await screen.findByRole('heading', { name: '画面ロック' })
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.type(screen.getByLabelText('もう一度'), '1234')
    await user.click(screen.getByRole('button', { name: 'PINを設定する' }))
    await screen.findByText('PINを使っています')
    await user.click(screen.getByRole('button', { name: '今すぐロックする' }))
    const lock = await screen.findByRole('dialog', { name: 'またね帳' })
    const input = within(lock).getByLabelText('PIN')
    for (let i = 0; i < 5; i++) {
      await user.type(input, '9999')
      await user.click(within(lock).getByRole('button', { name: '解除' }))
      await waitFor(() => expect((input as HTMLInputElement).value).toBe(''))
    }
    expect(await within(lock).findByText(/秒入力できません/)).toBeTruthy()
    expect((input as HTMLButtonElement).disabled).toBe(true)

    vi.setSystemTime(new Date(NOW.getTime() + 31_000))
    await waitFor(() => expect((input as HTMLButtonElement).disabled).toBe(false), { timeout: 3000 })
    await user.type(input, '1234')
    await user.click(within(lock).getByRole('button', { name: '解除' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'またね帳' })).toBeNull())
  })
})
