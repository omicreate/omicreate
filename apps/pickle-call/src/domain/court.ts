// コート図の配置。縦長のコートで、ネットは横。未反転では A チームが下。
// 下のチームはネットを向くので「画面の右＝自分の右」。上のチームはこちらを向くので「画面の左＝自分の右」。
import type { Quadrant, Side, Team } from './types'

export function toQuadrant(team: Team, side: Side, flipped: boolean): Quadrant {
  const bottom: Team = flipped ? 'B' : 'A'
  if (team === bottom) return side === 'right' ? 'BR' : 'BL'
  return side === 'right' ? 'TL' : 'TR'
}
