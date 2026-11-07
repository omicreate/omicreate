// 端末の中への保存（storage.ts）。Map で作った localStorage / sessionStorage を globalThis に差し込んで確かめる。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAll, HISTORY_MAX, isObj, load, PREFIX, save, upsertRecord } from './storage'

/** Web Storage の最小の代役（Map が中身） */
class MemoryStorage {
  readonly map = new Map<string, string>()
  failSet = false
  failGet = false
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(k: string) {
    if (this.failGet) throw new Error('SecurityError')
    return this.map.has(k) ? this.map.get(k)! : null
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
  setItem(k: string, v: string) {
    if (this.failSet) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    this.map.set(k, String(v))
  }
}

let local: MemoryStorage
let session: MemoryStorage

beforeEach(() => {
  local = new MemoryStorage()
  session = new MemoryStorage()
  vi.stubGlobal('localStorage', local)
  vi.stubGlobal('sessionStorage', session)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

interface Prefs {
  lang: 'ja' | 'en'
  rate: number
}
const DEFAULT: Prefs = { lang: 'ja', rate: 1 }
const isPrefs = (x: unknown): x is Prefs => isObj(x) && (x.lang === 'ja' || x.lang === 'en') && typeof x.rate === 'number'

describe('キーと包み方', () => {
  it('接頭辞は pickle-call:', () => {
    expect(PREFIX).toBe('pickle-call:')
  })

  it('save はキーに接頭辞を付け、{v:1, data} で包んで JSON で保存する', () => {
    expect(save('settings', { lang: 'en', rate: 1.2 })).toBe(true)
    expect([...local.map.keys()]).toEqual(['pickle-call:settings'])
    expect(JSON.parse(local.map.get('pickle-call:settings')!)).toEqual({ v: 1, data: { lang: 'en', rate: 1.2 } })
  })

  it('load は保存したものを取り出す', () => {
    save('settings', { lang: 'en', rate: 0.8 })
    expect(load('settings', DEFAULT, isPrefs)).toEqual({ lang: 'en', rate: 0.8 })
  })

  it('配列や文字列もそのまま往復する', () => {
    save('history', [{ id: 'a' }, { id: 'b' }])
    expect(load('history', [] as { id: string }[], (x): x is { id: string }[] => Array.isArray(x))).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  it('null か undefined を保存するとキーを消す', () => {
    save('current', { id: 'x' })
    expect(local.map.has('pickle-call:current')).toBe(true)
    expect(save('current', null)).toBe(true)
    expect(local.map.has('pickle-call:current')).toBe(false)
    save('current', { id: 'x' })
    save('current', undefined)
    expect(local.map.has('pickle-call:current')).toBe(false)
  })

  it('接頭辞のない同名のキーは読まない', () => {
    local.map.set('settings', JSON.stringify({ v: 1, data: { lang: 'en', rate: 2 } }))
    expect(load('settings', DEFAULT, isPrefs)).toBe(DEFAULT)
  })
})

describe('壊れていたら既定値に戻す', () => {
  const put = (raw: string) => local.map.set('pickle-call:settings', raw)

  it('何も保存されていない', () => {
    expect(load('settings', DEFAULT, isPrefs)).toBe(DEFAULT)
  })

  it.each([
    ['壊れた JSON', '{"v":1,"data":{'],
    ['JSON でない文字列', 'hello'],
    ['空文字', ''],
    ['null', 'null'],
    ['数字', '0'],
    ['文字列の JSON', '"settings"'],
    ['配列', '[1,2]'],
  ])('%s', (_label, raw) => {
    put(raw)
    expect(load('settings', DEFAULT, isPrefs)).toBe(DEFAULT)
  })

  it('別の版（v が 1 でない、v がない）', () => {
    put(JSON.stringify({ v: 2, data: { lang: 'en', rate: 1 } }))
    expect(load('settings', DEFAULT, isPrefs)).toBe(DEFAULT)
    put(JSON.stringify({ v: '1', data: { lang: 'en', rate: 1 } }))
    expect(load('settings', DEFAULT, isPrefs)).toBe(DEFAULT)
    put(JSON.stringify({ data: { lang: 'en', rate: 1 } }))
    expect(load('settings', DEFAULT, isPrefs)).toBe(DEFAULT)
  })

  it('形が違う（検査に通らない）', () => {
    put(JSON.stringify({ v: 1, data: { lang: 'fr', rate: 1 } }))
    expect(load('settings', DEFAULT, isPrefs)).toBe(DEFAULT)
    put(JSON.stringify({ v: 1, data: null }))
    expect(load('settings', DEFAULT, isPrefs)).toBe(DEFAULT)
    put(JSON.stringify({ v: 1 }))
    expect(load('settings', DEFAULT, isPrefs)).toBe(DEFAULT)
  })

  it('検査で例外が出ても既定値', () => {
    save('settings', { lang: 'en', rate: 1 })
    const boom = (_x: unknown): _x is Prefs => {
      throw new Error('boom')
    }
    expect(load('settings', DEFAULT, boom)).toBe(DEFAULT)
  })
})

describe('落ちない（容量超過・プライベートブラウズ・storage なし）', () => {
  it('setItem が投げても save は例外を出さず false を返す（容量超過）', () => {
    local.failSet = true
    expect(() => save('history', [{ id: 'x' }])).not.toThrow()
    expect(save('history', [{ id: 'x' }])).toBe(false)
  })

  it('JSON にできない値（循環参照）でも save は false を返すだけ', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    expect(save('current', a)).toBe(false)
  })

  it('getItem が投げても load は既定値を返す', () => {
    local.failGet = true
    expect(load('settings', DEFAULT, isPrefs)).toBe(DEFAULT)
  })

  it('localStorage がない環境', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(load('settings', DEFAULT, isPrefs)).toBe(DEFAULT)
    expect(save('settings', DEFAULT)).toBe(false)
    expect(() => clearAll()).not.toThrow()
  })

  it('localStorage に触るだけで例外になる環境（サンドボックスの iframe など）', () => {
    vi.unstubAllGlobals()
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
    try {
      expect(load('settings', DEFAULT, isPrefs)).toBe(DEFAULT)
      expect(save('settings', DEFAULT)).toBe(false)
      expect(() => clearAll()).not.toThrow()
    } finally {
      if (desc) Object.defineProperty(globalThis, 'localStorage', desc)
      else delete (globalThis as { localStorage?: unknown }).localStorage
    }
  })
})

describe('clearAll', () => {
  it('pickle-call: で始まるキーだけを消し、同じオリジンの姉妹アプリの記録は残す', () => {
    save('settings', DEFAULT)
    save('history', [])
    save('learn', {})
    local.map.set('pickle-asobi:best', '{"v":1,"data":3}')
    local.map.set('theme', 'dark')
    local.map.set('xpickle-call:settings', 'keep')
    session.map.set('pickle-call:src', 'qr')
    session.map.set('pickle-asobi:src', 'keep')
    clearAll()
    expect([...local.map.keys()].sort()).toEqual(['pickle-asobi:best', 'theme', 'xpickle-call:settings'])
    expect([...session.map.keys()]).toEqual(['pickle-asobi:src'])
  })

  it('何もなくても落ちない', () => {
    expect(() => clearAll()).not.toThrow()
    expect(local.map.size).toBe(0)
  })

  it('sessionStorage がなくても localStorage は消す', () => {
    save('settings', DEFAULT)
    vi.stubGlobal('sessionStorage', undefined)
    expect(() => clearAll()).not.toThrow()
    expect(local.map.size).toBe(0)
  })
})

describe('upsertRecord（履歴）', () => {
  const rec = (id: string, n = 0) => ({ id, n })

  it('新しい記録を先頭に入れる', () => {
    expect(upsertRecord([rec('a'), rec('b')], rec('c'))).toEqual([rec('c'), rec('a'), rec('b')])
  })

  it('同じ id は置き換えて先頭へ（重複しない）', () => {
    const out = upsertRecord([rec('a'), rec('b', 1), rec('c')], rec('b', 2))
    expect(out).toEqual([rec('b', 2), rec('a'), rec('c')])
    expect(out.filter((r) => r.id === 'b')).toHaveLength(1)
  })

  it('最大100件。あふれたら古いもの（末尾）から落とす', () => {
    expect(HISTORY_MAX).toBe(100)
    const list = Array.from({ length: 100 }, (_, i) => rec(`r${i}`))
    const out = upsertRecord(list, rec('new'))
    expect(out).toHaveLength(100)
    expect(out[0].id).toBe('new')
    expect(out[99].id).toBe('r98')
    expect(out.some((r) => r.id === 'r99')).toBe(false)
    // 置き換えのときは件数が増えない
    expect(upsertRecord(list, rec('r50', 9))).toHaveLength(100)
    // すでに100件を超えていても100件に切る
    expect(upsertRecord(Array.from({ length: 150 }, (_, i) => rec(`x${i}`)), rec('y'))).toHaveLength(100)
  })

  it('元の配列は書き換えない', () => {
    const list = Object.freeze([rec('a'), rec('b')])
    const out = upsertRecord(list, rec('a', 5))
    expect(list).toEqual([rec('a'), rec('b')])
    expect(out).not.toBe(list)
  })
})

describe('isObj', () => {
  it('ふつうのオブジェクトだけ true', () => {
    expect(isObj({})).toBe(true)
    expect(isObj({ a: 1 })).toBe(true)
    expect(isObj(null)).toBe(false)
    expect(isObj([])).toBe(false)
    expect(isObj('x')).toBe(false)
    expect(isObj(1)).toBe(false)
    expect(isObj(undefined)).toBe(false)
  })
})
