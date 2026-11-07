// 404.html（見つからないパスをアプリの入口へ戻す小さなスクリプト）: 行き先が同じサイトの中にとどまり、
// /pickle-call/learn?scene=x のような道すじのリンクは #/learn?scene=x に読みかえる。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const html = readFileSync(new URL('../../public/404.html', import.meta.url), 'utf8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]

/** 404.html のスクリプトを、与えた URL で開いたことにして動かす。replace() に渡された行き先と、リンクの href を返す */
function run(url: string): { replaced: string | null; link: string | null; resolved: string | null } {
  const u = new URL(url)
  let replaced: string | null = null
  let onReady: (() => void) | null = null
  const location = { href: u.href, pathname: u.pathname, search: u.search, hash: u.hash, replace: (to: string) => (replaced = to) }
  let link: string | null = null
  const document = {
    addEventListener: (_: string, fn: () => void) => (onReady = fn),
    getElementById: () => ({ setAttribute: (_: string, v: string) => (link = v) }),
  }
  new Function('location', 'document', script)(location, document)
  ;(onReady as (() => void) | null)?.()
  return { replaced, link, resolved: replaced === null ? null : new URL(replaced, u.href).href }
}

const ORIGIN = 'https://omicreate.github.io'

describe('404.html の行き先', () => {
  it('道すじの画面名は #/画面 に読みかえる。?lang= や ?src= も引きつぐ', () => {
    expect(run(`${ORIGIN}/pickle-call/play`).replaced).toBe('/pickle-call/#/play')
    expect(run(`${ORIGIN}/pickle-call/play?src=reel`).replaced).toBe('/pickle-call/#/play?src=reel')
    expect(run(`${ORIGIN}/pickle-call/foo?lang=en`).replaced).toBe('/pickle-call/?lang=en')
    expect(run(`${ORIGIN}/pickle-call/settings#/guide`).replaced).toBe('/pickle-call/#/guide')
  })

  it('学ぶの場面の直リンク（/pickle-call/learn?scene=x）は、場面をハッシュの中へ入れる', () => {
    expect(run(`${ORIGIN}/pickle-call/learn?scene=rally-win`).replaced).toBe('/pickle-call/#/learn?scene=rally-win')
    expect(run(`${ORIGIN}/pickle-call/learn?scene=rally-win&lang=en`).replaced).toBe('/pickle-call/#/learn?scene=rally-win&lang=en')
  })

  it.each([
    '//x//attacker.example/pickle-call/',
    '//x//attacker.example/pickle-call/play',
    '///attacker.example/pickle-call/',
    '//attacker.example//pickle-call/learn?scene=x',
  ])('パスが「//」で始まっても別のサイトへは飛ばない（%s）', (path) => {
    const r = run(`${ORIGIN}${path}`)
    if (r.resolved) expect(new URL(r.resolved).origin).toBe(ORIGIN)
    expect(r.link?.startsWith('//')).not.toBe(true)
    if (r.link) expect(new URL(r.link, `${ORIGIN}${path}`).origin).toBe(ORIGIN)
  })
})
