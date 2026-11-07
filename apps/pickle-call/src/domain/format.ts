import type { Format } from './types'

/** 計測や履歴で使う短い形式コード。例: d-so-11（ダブルス・サイドアウト・11点）、s-ra-15 */
export function formatCode(f: Format): string {
  return `${f.kind === 'doubles' ? 'd' : 's'}-${f.scoring === 'sideout' ? 'so' : 'ra'}-${f.target}`
}
