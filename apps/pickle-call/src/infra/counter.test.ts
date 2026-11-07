// 匿名の回数（counter.ts）: 判定の順（off-config → off-site → off-user → off-dnt → on）、URL の組み立て、src の検証、送り方。
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatCode } from '../domain/format'
import type { Format } from '../domain/types'
import { APP_ID, APP_VERSION, browserEnv, counterStatus, counterUrl, isValidSrc, PUBLIC_URL, type CounterEnv } from './counter'

const BASE = 'https://script.example.com/macros/s/abc/exec'
const ON: CounterEnv = {
  counterUrl: BASE,
  publicUrl: 'https://omicreate.github.io/pickle-call/',
  hostname: 'omicreate.github.io',
  userOn: true,
  doNotTrack: null,
  gpc: undefined,
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('counterStatus', () => {
  it('すべてそろえば on', () => {
    expect(counterStatus(ON)).toBe('on')
    expect(counterStatus({ ...ON, doNotTrack: '0', gpc: false })).toBe('on')
    expect(counterStatus({ ...ON, doNotTrack: 'unspecified' })).toBe('on')
  })

  it('off-config: 送信先が空か https でない', () => {
    expect(counterStatus({ ...ON, counterUrl: '' })).toBe('off-config')
    expect(counterStatus({ ...ON, counterUrl: 'http://script.example.com/exec' })).toBe('off-config')
    expect(counterStatus({ ...ON, counterUrl: 'javascript:alert(1)' })).toBe('off-config')
    expect(counterStatus({ ...ON, counterUrl: ' https://x.example' })).toBe('off-config')
  })

  it('off-site: 公開URLのホスト以外（公開URLが壊れていても送らない）', () => {
    expect(counterStatus({ ...ON, hostname: 'example.org' })).toBe('off-site')
    expect(counterStatus({ ...ON, hostname: '' })).toBe('off-site')
    expect(counterStatus({ ...ON, publicUrl: 'not a url' })).toBe('off-site')
    expect(counterStatus({ ...ON, publicUrl: '' })).toBe('off-site')
  })

  it('off-user: 設定で「送らない」', () => {
    expect(counterStatus({ ...ON, userOn: false })).toBe('off-user')
  })

  it('off-dnt: Do Not Track か GPC', () => {
    expect(counterStatus({ ...ON, doNotTrack: '1' })).toBe('off-dnt')
    expect(counterStatus({ ...ON, gpc: true })).toBe('off-dnt')
  })

  it('判定の順: off-config → off-site → off-user → off-dnt', () => {
    const allOff: CounterEnv = { counterUrl: '', publicUrl: ON.publicUrl, hostname: 'example.org', userOn: false, doNotTrack: '1', gpc: true }
    expect(counterStatus(allOff)).toBe('off-config')
    expect(counterStatus({ ...allOff, counterUrl: BASE })).toBe('off-site')
    expect(counterStatus({ ...allOff, counterUrl: BASE, hostname: ON.hostname })).toBe('off-user')
    expect(counterStatus({ ...allOff, counterUrl: BASE, hostname: ON.hostname, userOn: true })).toBe('off-dnt')
    expect(counterStatus({ ...allOff, counterUrl: BASE, hostname: ON.hostname, userOn: true, doNotTrack: null, gpc: false })).toBe('on')
  })
})

describe('counterUrl', () => {
  const params = (url: string) => new URL(url).searchParams

  it('app・ev・v が必ず入る。ほかは付けない', () => {
    const url = counterUrl(BASE, { ev: 'open' })
    expect(url.startsWith(`${BASE}?`)).toBe(true)
    const p = params(url)
    expect(p.get('app')).toBe('pickle-call')
    expect(p.get('ev')).toBe('open')
    expect(p.get('v')).toBe(APP_VERSION)
    expect([...p.keys()].sort()).toEqual(['app', 'ev', 'v'])
  })

  it('game・src・pwa は指定したときだけ', () => {
    const p = params(counterUrl(BASE, { ev: 'start', game: 'd-so-11', src: 'qr_2026-Nov', pwa: true }))
    expect(Object.fromEntries(p)).toEqual({ app: 'pickle-call', ev: 'start', v: APP_VERSION, game: 'd-so-11', src: 'qr_2026-Nov', pwa: '1' })
    expect(params(counterUrl(BASE, { ev: 'open', pwa: false })).get('pwa')).toBe('0')
    expect(params(counterUrl(BASE, { ev: 'open', src: null })).has('src')).toBe(false)
    expect(params(counterUrl(BASE, { ev: 'finish', game: 'learn' })).get('game')).toBe('learn')
    expect(params(counterUrl(BASE, { ev: 'share', game: 'result' })).get('game')).toBe('result')
  })

  it.each([
    ['空白', 'a b'],
    ['イコール', 'a=b'],
    ['アンド', 'a&b'],
    ['41文字', 'x'.repeat(41)],
    ['空', ''],
    ['日本語', 'ちらし'],
    ['スラッシュ', 'a/b'],
    ['ドット', 'a.b'],
  ])('src が不正（%s）なら付けない', (_label, src) => {
    expect(params(counterUrl(BASE, { ev: 'open', src })).has('src')).toBe(false)
  })

  it.each([
    ['大文字', 'D-SO-11'],
    ['空白', 'd so 11'],
    ['21文字', 'g'.repeat(21)],
    ['空', ''],
    ['記号', 'd_so_11'],
    ['クエリの差し込み', 'x&ev=hack'],
  ])('game が不正（%s）なら付けない', (_label, game) => {
    const p = params(counterUrl(BASE, { ev: 'start', game }))
    expect(p.has('game')).toBe(false)
    expect(p.getAll('ev')).toEqual(['start'])
  })

  it('12の形式コード（formatCode）はどれも game として通る', () => {
    for (const kind of ['doubles', 'singles'] as const) {
      for (const scoring of ['sideout', 'rally'] as const) {
        for (const target of [11, 15, 21] as const) {
          const f: Format = { kind, scoring, target, winBy: 2 }
          const code = formatCode(f)
          expect(code).toMatch(/^[ds]-(so|ra)-(11|15|21)$/)
          expect(params(counterUrl(BASE, { ev: 'start', game: code })).get('game')).toBe(code)
        }
      }
    }
    expect(formatCode({ kind: 'doubles', scoring: 'sideout', target: 11, winBy: 2 })).toBe('d-so-11')
    expect(formatCode({ kind: 'singles', scoring: 'rally', target: 15, winBy: 1 })).toBe('s-ra-15')
  })

  it('送信先にクエリがすでにあれば & でつなぐ', () => {
    const url = counterUrl(`${BASE}?k=1`, { ev: 'open' })
    expect(url).toBe(`${BASE}?k=1&app=pickle-call&ev=open&v=${APP_VERSION}`)
    expect(params(url).get('k')).toBe('1')
  })

  it('名前やスコアにあたるものは送らない（キーは決まったものだけ）', () => {
    const url = counterUrl(BASE, { ev: 'finish', game: 'd-ra-21', src: 'insta', pwa: true })
    expect([...params(url).keys()].sort()).toEqual(['app', 'ev', 'game', 'pwa', 'src', 'v'])
  })
})

describe('isValidSrc', () => {
  it('英数字・ハイフン・アンダースコアの1〜40文字', () => {
    expect(isValidSrc('a')).toBe(true)
    expect(isValidSrc('QR_flyer-01')).toBe(true)
    expect(isValidSrc('x'.repeat(40))).toBe(true)
  })

  it('それ以外は不正', () => {
    for (const s of ['', 'x'.repeat(41), 'a b', 'a=b', 'a&b', 'a?b', 'a#b', 'ちらし', '%20', null, undefined]) expect(isValidSrc(s)).toBe(false)
  })
})

describe('定数', () => {
  it('APP_ID は pickle-call、APP_VERSION は package.json の version と同じ', () => {
    expect(APP_ID).toBe('pickle-call')
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }
    expect(APP_VERSION).toBe(pkg.version)
  })

  it('公開URLは https', () => {
    expect(new URL(PUBLIC_URL).protocol).toBe('https:')
  })
})

describe('browserEnv と track（送り方）', () => {
  function stubBrowser(opts: { hostname?: string; dnt?: string | null; gpc?: boolean; beacon?: () => boolean; src?: string | null } = {}) {
    const sendBeacon = vi.fn((_url: string) => (opts.beacon ? opts.beacon() : true))
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response(null)))
    vi.stubGlobal('navigator', { sendBeacon, doNotTrack: opts.dnt ?? null, globalPrivacyControl: opts.gpc })
    vi.stubGlobal('location', { hostname: opts.hostname ?? 'omicreate.github.io' })
    vi.stubGlobal('fetch', fetchMock)
    const store = new Map<string, string>()
    if (opts.src) store.set('pickle-call:src', opts.src)
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null })
    return { sendBeacon, fetchMock }
  }

  /** 送信先を設定したビルドを模す（モジュールを読み直す） */
  async function configured() {
    vi.stubEnv('VITE_COUNTER_URL', BASE)
    vi.stubEnv('VITE_PUBLIC_URL', 'https://omicreate.github.io/pickle-call/')
    vi.resetModules()
    return import('./counter')
  }

  it('browserEnv はブラウザの値を集める', () => {
    stubBrowser({ hostname: 'example.org', dnt: '1', gpc: true })
    const env = browserEnv(false)
    expect(env).toMatchObject({ hostname: 'example.org', userOn: false, doNotTrack: '1', gpc: true, publicUrl: PUBLIC_URL })
  })

  it('送信先を設定していないビルドでは何も送らない', async () => {
    vi.resetModules()
    const m = await import('./counter')
    const { sendBeacon, fetchMock } = stubBrowser()
    m.track(true, 'open')
    m.track(true, 'start', 'd-so-11')
    expect(sendBeacon).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('on のとき sendBeacon で送る。open は1回だけで pwa つき、src は sessionStorage から', async () => {
    const m = await configured()
    const { sendBeacon, fetchMock } = stubBrowser({ src: 'qr1' })
    expect(m.counterStatus(m.browserEnv(true))).toBe('on')
    m.track(true, 'open')
    m.track(true, 'open')
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const open = new URL(sendBeacon.mock.calls[0][0])
    expect(`${open.origin}${open.pathname}`).toBe(BASE)
    expect(Object.fromEntries(open.searchParams)).toEqual({ app: 'pickle-call', ev: 'open', v: APP_VERSION, src: 'qr1', pwa: '0' })
    m.track(true, 'start', 'd-so-11')
    const start = new URL(sendBeacon.mock.calls[1][0])
    expect(Object.fromEntries(start.searchParams)).toEqual({ app: 'pickle-call', ev: 'start', v: APP_VERSION, game: 'd-so-11', src: 'qr1' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sendBeacon が使えなければ fetch（no-cors・Cookie なし・リファラーなし）', async () => {
    const m = await configured()
    const { fetchMock } = stubBrowser({ beacon: () => false })
    m.track(true, 'finish', 'learn')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(new URL(url).searchParams.get('game')).toBe('learn')
    expect(init).toMatchObject({ mode: 'no-cors', credentials: 'omit', keepalive: true, referrerPolicy: 'no-referrer' })
  })

  it.each([
    ['設定で送らない', { userOn: false }],
    ['Do Not Track', { userOn: true, dnt: '1' }],
    ['GPC', { userOn: true, gpc: true }],
    ['公開URL以外', { userOn: true, hostname: 'example.org' }],
  ])('%s なら送らない', async (_label, o: { userOn: boolean; dnt?: string; gpc?: boolean; hostname?: string }) => {
    const m = await configured()
    const { sendBeacon, fetchMock } = stubBrowser(o)
    m.track(o.userOn, 'open')
    m.track(o.userOn, 'share', 'result')
    expect(sendBeacon).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('送るのに失敗してもアプリは止めない（例外を外に出さない）', async () => {
    const m = await configured()
    stubBrowser({
      beacon: () => {
        throw new Error('blocked')
      },
    })
    expect(() => m.track(true, 'start', 'd-so-11')).not.toThrow()
    const { fetchMock } = stubBrowser({ beacon: () => false })
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')))
    expect(() => m.track(true, 'finish', 'd-so-11')).not.toThrow()
    await Promise.resolve()
  })
})
