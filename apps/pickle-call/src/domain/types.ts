// ピックルコールの型。DOM に触れない純粋な型だけを置く。

export type Team = 'A' | 'B'
export type PlayerId = 'A1' | 'A2' | 'B1' | 'B2'
export type Side = 'right' | 'left'
export type Kind = 'doubles' | 'singles'
export type Scoring = 'sideout' | 'rally'
export type Target = 11 | 15 | 21
export type Lang = 'ja' | 'en'

export interface Format {
  kind: Kind
  scoring: Scoring
  target: Target
  winBy: 1 | 2
}

export interface Setup {
  format: Format
  /** 空文字や未設定は「名前なし」 */
  names: Partial<Record<PlayerId, string>>
  /** ゲーム開始時に右に立ち、そのチームで最初にサーブする人（5.B.3・用語集） */
  startingServer: Record<Team, PlayerId>
  firstServingTeam: Team
  rulesetId: 'usap-2026'
}

export type RallyEvent = { type: 'rally'; winner: Team; at: number }
export type SetEvent = {
  type: 'set'
  score: Record<Team, number>
  servingTeam: Team
  serverNumber: 1 | 2 | null
  server: PlayerId
  startingServer: Record<Team, PlayerId>
  at: number
}
export type GameEvent = RallyEvent | SetEvent

export interface GameState {
  score: Record<Team, number>
  servingTeam: Team
  /** ダブルスのサイドアウト方式だけ 1 か 2。ほかは null */
  serverNumber: 1 | 2 | null
  server: PlayerId
  startingServer: Record<Team, PlayerId>
  winner: Team | null
  rallies: number
  sideOuts: number
  /** エンドチェンジの目安を立てたラリー番号（立てていなければ null） */
  endChangeAt: number | null
}

export type ExplainKey =
  | 'start'
  | 'start-singles'
  | 'start-rally'
  | 'point'
  | 'point-singles'
  | 'second-server'
  | 'side-out'
  | 'side-out-start'
  | 'side-out-singles'
  | 'rally-point'
  | 'rally-point-singles'
  | 'rally-side-out'
  | 'rally-side-out-singles'
  | 'game'
  | 'manual'

export type Quadrant = 'TL' | 'TR' | 'BL' | 'BR'

export interface View {
  call: number[]
  /** 例: "4-2-1" */
  callText: string
  /** その場にいる選手の左右（各チーム自身から見た左右） */
  positions: Partial<Record<PlayerId, Side>>
  server: PlayerId
  serverSide: Side
  receiver: PlayerId
  servingTeam: Team
  serverNumber: 1 | 2 | null
  /** 次の1点で勝てるチーム */
  gamePoint: Team[]
  endChangeNow: boolean
  isSideOut: boolean
  explain: { key: ExplainKey; refs: string[] }
}
