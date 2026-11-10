// コート図の配置（court.ts）。縦長のコートでネットは横、未反転では A が下。
// 下のチームはネットを向くので「画面の右＝自分の右」、上のチームはこちらを向くので「画面の左＝自分の右」（仕様 §8 の表）。
import { describe, expect, it } from 'vitest'
import { toQuadrant } from './court'
import type { Quadrant, Side, Team } from './types'

describe('toQuadrant の8通り', () => {
  it.each<[Team, Side, boolean, Quadrant]>([
    ['A', 'right', false, 'BR'],
    ['A', 'left', false, 'BL'],
    ['B', 'right', false, 'TL'],
    ['B', 'left', false, 'TR'],
    ['A', 'right', true, 'TL'],
    ['A', 'left', true, 'TR'],
    ['B', 'right', true, 'BR'],
    ['B', 'left', true, 'BL'],
  ])('%s の %s（反転=%s）→ %s', (team, side, flipped, q) => {
    expect(toQuadrant(team, side, flipped)).toBe(q)
  })
})

describe('toQuadrant の性質', () => {
  const teams: Team[] = ['A', 'B']
  const sides: Side[] = ['right', 'left']
  const mirror: Record<Quadrant, Quadrant> = { TL: 'BR', BR: 'TL', TR: 'BL', BL: 'TR' }

  it.each([false, true])('反転=%s でも4人は4つの区画に1人ずつ', (flipped) => {
    const qs = teams.flatMap((t) => sides.map((s) => toQuadrant(t, s, flipped)))
    expect(new Set(qs).size).toBe(4)
  })

  it('上下を入れ替えると、区画は点対称に移る（コートを180度回したのと同じ）', () => {
    for (const t of teams) for (const s of sides) expect(toQuadrant(t, s, true)).toBe(mirror[toQuadrant(t, s, false)])
  })

  it('同じチームの右と左は、同じ半面（上か下）の左右に分かれる', () => {
    for (const flipped of [false, true]) {
      for (const t of teams) {
        const r = toQuadrant(t, 'right', flipped)
        const l = toQuadrant(t, 'left', flipped)
        expect(r[0]).toBe(l[0])
        expect(r[1]).not.toBe(l[1])
      }
    }
  })

  it('対角（サーバーとレシーバーは同じ「自分の側」）は、画面でも対角になる', () => {
    const diagonal = (a: Quadrant, b: Quadrant) => a[0] !== b[0] && a[1] !== b[1]
    for (const flipped of [false, true]) {
      for (const s of sides) expect(diagonal(toQuadrant('A', s, flipped), toQuadrant('B', s, flipped))).toBe(true)
    }
  })
})
