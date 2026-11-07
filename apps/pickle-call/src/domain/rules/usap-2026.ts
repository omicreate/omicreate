// USA Pickleball Official Rulebook 2026 にもとづく規則データ。
// 条文は転載せず（ルールブックに無断転載禁止の表示がある）、自分の言葉の要約と条番号だけを持つ。
// 規則が改訂されたら、このファイルを複製して版を足す（エンジンは版に依存しない書き方にしてある）。
import type { ExplainKey, Kind, Scoring, Target } from '../types'

export interface Source {
  label: { ja: string; en: string }
  url: string
}

export interface Ruleset {
  id: 'usap-2026'
  title: { ja: string; en: string }
  /** 一次情報と照合した日 */
  checkedAt: string
  sources: Source[]
  /** 条番号 → 短い見出し */
  refs: Record<string, { ja: string; en: string }>
  /** 1ゲームマッチ・決勝ゲームでのエンドチェンジの目安（21.B.1〜21.B.3） */
  endChange: Record<Target, number>
  /** 「なぜこのスコア？」の条番号 */
  explainRefs: Record<ExplainKey, string[]>
  /** 「なぜこのスコア？」の短い説明（自分の言葉） */
  summaries: Record<ExplainKey, { ja: string; en: string }>
}

export const RULESET: Ruleset = {
  id: 'usap-2026',
  title: { ja: 'USA Pickleball 公式ルール 2026年版', en: 'USA Pickleball Official Rulebook 2026' },
  checkedAt: '2026-11-06',
  sources: [
    {
      label: { ja: 'USA Pickleball 公式ルールブック（公式ページ）', en: 'USA Pickleball Official Rulebook (official page)' },
      url: 'https://usapickleball.org/rules/',
    },
    {
      label: { ja: '2026年版ルールブックPDF（Pickleball Canada 掲載。照合に使用）', en: '2026 Rulebook PDF (hosted by Pickleball Canada; used for checking)' },
      url: 'https://pickleballcanada.org/wp-content/uploads/2026/03/2026-Official-Rulebook-EN.pdf',
    },
    {
      label: { ja: '2026年版の変更点（Change Document）', en: '2026 Rulebook Change Document' },
      url: 'https://pickleballcanada.org/wp-content/uploads/2026/04/2026-Rulebook-Change-Document-EN.pdf',
    },
    {
      label: { ja: '日本ピックルボール協会 ルール解説（用語の参考）', en: 'Japan Pickleball Association: rules guide (terminology)' },
      url: 'https://japanpickleball.org/pickleball/rule/',
    },
  ],
  refs: {
    '4.A': { ja: '得点（標準）', en: 'Standard scoring' },
    '4.B': { ja: 'ゲームの勝ち', en: 'Winning the game' },
    '5.A.1': { ja: 'シングルスのサーブ位置', en: 'Singles server position' },
    '5.A.2': { ja: 'シングルスのサーブ継続', en: 'Singles: holding serve' },
    '5.A.3': { ja: 'シングルスのサイドアウト', en: 'Singles side out' },
    '5.B': { ja: 'ダブルスのサーブ順', en: 'Doubles serving sequence' },
    '5.B.2': { ja: '1人目・2人目のサーバー', en: 'First and second servers' },
    '5.B.3': { ja: 'サーブ・レシーブの正しい位置', en: 'Correct serving and receiving positions' },
    '5.B.5': { ja: '1人目のサーバーが続く間', en: 'Duration of first server' },
    '5.B.6': { ja: '2人目のサーバーが続く間', en: 'Duration of second server' },
    '5.C': { ja: '位置の誤り（質問と扱い）', en: 'Questions about server, receiver and positions' },
    '6.B.1': { ja: 'コール（シングルス）', en: 'Calling the score (singles)' },
    '6.B.2': { ja: 'コール（ダブルス）', en: 'Calling the score (doubles)' },
    '6.D': { ja: 'コール後10秒以内にサーブ', en: '10-second rule' },
    '14.A.2': { ja: 'ラリー方式の得点（仮規則）', en: 'Rally scoring: points (provisional)' },
    '14.A.3': { ja: 'ラリー方式のコール（仮規則）', en: 'Rally scoring: calling the score (provisional)' },
    '14.A.4': { ja: 'ラリー方式のサーブ（仮規則）', en: 'Rally scoring: serving (provisional)' },
    '14.A.5': { ja: 'ラリー方式はサーバー1人（仮規則）', en: 'Rally scoring: one server (provisional)' },
    '15.C': { ja: '大会の点数形式', en: 'Tournament scoring options' },
    '21.B.1': { ja: 'エンドチェンジ（11点）', en: 'End change (11-point game)' },
    '21.B.2': { ja: 'エンドチェンジ（15点）', en: 'End change (15-point game)' },
    '21.B.3': { ja: 'エンドチェンジ（21点）', en: 'End change (21-point game)' },
    '21.B.4': { ja: 'エンドチェンジ後もサーバーは同じ', en: 'No server change after end change' },
    '21.F.2': { ja: 'ゲーム間でエンドとサーブを交代', en: 'Change ends and first serve between games' },
    '21.F.3': { ja: 'ゲーム間のスターティングサーバー変更', en: 'Change of starting server between games' },
    'CD-2242': { ja: '2026年改訂: ラリー方式はレシーブ側も決勝点を取れる', en: '2026 change: receivers can win the game in rally scoring' },
  },
  endChange: { 11: 6, 15: 8, 21: 11 },
  explainRefs: {
    start: ['5.B', '5.B.2', '6.B.2'],
    'start-singles': ['5.A.1', '6.B.1'],
    'start-rally': ['14.A.3', '14.A.5', '5.B.3'],
    point: ['4.A', '5.B.3', '5.B.5'],
    'point-singles': ['4.A', '5.A.1', '5.A.2'],
    'second-server': ['5.B.5', '5.B.3'],
    'side-out': ['5.B.6', '5.B.2'],
    'side-out-start': ['5.B', '5.B.2'],
    'side-out-singles': ['5.A.3', '5.A.1'],
    'rally-point': ['14.A.2', '14.A.4'],
    'rally-point-singles': ['14.A.2', '5.A.2'],
    'rally-side-out': ['14.A.2', '14.A.4', '14.A.5'],
    'rally-side-out-singles': ['14.A.2', '5.A.1'],
    game: ['4.B', '15.C'],
    manual: [],
  },
  summaries: {
    start: {
      ja: 'ゲームの最初は、サーブ側が1人だけサーブします。その人は「2人目」として数えるので「0-0-2」です。',
      en: 'At the start of a game only one player on the serving team serves, counted as the second server, so the call is "0-0-2".',
    },
    'start-singles': {
      ja: 'シングルスのコールは2つの数字です。最初は「0-0」で、0は偶数なので右からサーブします。',
      en: 'Singles calls two numbers. The game starts at "0-0"; zero is even, so the serve is from the right.',
    },
    'start-rally': {
      ja: 'ラリー方式（仮規則）はダブルスでもコールが2つの数字です。サーバーは1人なので、サーバー番号はつけません。',
      en: 'In rally scoring (provisional) doubles also call two numbers. There is only one server, so there is no server number.',
    },
    point: {
      ja: 'サーブ側がラリーに勝つと1点。同じサーバーが左右を替えて続けます。レシーブ側は動きません。',
      en: 'The serving team won the rally and scores. The same server switches sides and serves again. The receivers stay put.',
    },
    'point-singles': {
      ja: 'サーバーがラリーに勝つと1点。サーバーの点が偶数なら右、奇数なら左からサーブします。',
      en: 'The server won the rally and scores. Serve from the right when the server\'s score is even, from the left when odd.',
    },
    'second-server': {
      ja: '1人目のサーバーがラリーに負けたので、パートナーが2人目のサーバーとして、いま立っている位置からサーブします。',
      en: 'The first server lost the rally, so the partner serves as the second server from where they are standing.',
    },
    'side-out': {
      ja: '2人目のサーバーが負けたのでサイドアウト。相手チームで、点数どおりに右に立つ人が1人目のサーバーです。',
      en: 'The second server lost the rally: side out. On the other team, the player correctly on the right for their score is the first server.',
    },
    'side-out-start': {
      ja: '最初のサーブ側は1人だけなので、1回負けるとすぐサイドアウトです。相手の右の人が1人目のサーバーです。',
      en: 'The team that started serving has only one server in its first turn, so one lost rally means side out. The opponent on the right is the first server.',
    },
    'side-out-singles': {
      ja: 'サーバーが負けたのでサイドアウト。相手が自分の点数どおりの側からサーブします。',
      en: 'The server lost the rally: side out. The opponent serves from the side that matches their own score.',
    },
    'rally-point': {
      ja: 'ラリー方式では勝った側に毎回1点。サーブ側が勝ったので、同じサーバーが左右を替えて続けます。',
      en: 'In rally scoring every rally scores. The serving team won, so the same server switches sides and serves again.',
    },
    'rally-point-singles': {
      ja: 'ラリー方式では勝った側に毎回1点。サーバーが勝ったので、点数の偶奇の側から続けます。',
      en: 'In rally scoring every rally scores. The server won and keeps serving from the side that matches their score.',
    },
    'rally-side-out': {
      ja: 'レシーブ側が勝って1点とサーブ権を得ました。点数どおりに右に立つ人がサーブします（サーバーは1人だけ）。',
      en: 'The receiving team won a point and the serve. The player correctly on the right for their score serves (only one server).',
    },
    'rally-side-out-singles': {
      ja: 'レシーバーが勝って1点とサーブ権を得ました。自分の点数の偶奇の側からサーブします。',
      en: 'The receiver won a point and the serve, and serves from the side that matches their score.',
    },
    game: {
      ja: '目標点に達し、必要な点差がついたのでゲーム終了です。',
      en: 'The target score was reached with the required margin, so the game is over.',
    },
    manual: {
      ja: 'スコアを手で直しました。立ち位置は点数の偶奇から決めています。',
      en: 'The score was corrected by hand. Positions follow from each team\'s score.',
    },
  },
}

/** 形式に合う「開始」の説明キー */
export function startKey(kind: Kind, scoring: Scoring): ExplainKey {
  if (kind === 'singles') return 'start-singles'
  return scoring === 'rally' ? 'start-rally' : 'start'
}
