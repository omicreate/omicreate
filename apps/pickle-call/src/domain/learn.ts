// 「学ぶ」（3択）。正解は問題データに手書きせず、必ずエンジンで計算する。
import { applyEvent, initialState, replay } from './engine'
import { RULESET } from './rules/usap-2026'
import { teamLabel } from './speech-text'
import type { Format, GameEvent, GameState, Lang, PlayerId, Setup, Team, View } from './types'
import { deriveView, explainKeyOf } from './view'

export type Ask = 'call' | 'server' | 'receiver' | 'side' | 'outcome' | 'endchange'

export interface Scene {
  id: string
  format?: Partial<Format>
  /** 勝ったチームの列。最後の1つが「このあと起きたこと」 */
  seq: Team[]
  ask: Ask
  /** side の問いで、どの人の位置を聞くか */
  subject?: PlayerId
  /** outcome の問いで、次のラリーに勝つチーム */
  hypo?: Team
  question: { ja: string; en: string }
  /** 追加の解説（自動の説明に足す） */
  note?: { ja: string; en: string }
  refs: string[]
}

const rep = (t: Team, n: number): Team[] => Array.from({ length: n }, () => t)

export const SCENES: Scene[] = [
  { id: 'start-call', seq: [], ask: 'call', question: { ja: '最初のコールは？', en: 'What is the first score call?' }, refs: ['6.B.2', '5.B'] },
  { id: 'first-point', seq: ['A'], ask: 'call', question: { ja: '次のコールは？', en: 'What is the next call?' }, refs: ['4.A', '6.B.2'] },
  {
    id: 'server-moves',
    seq: ['A'],
    ask: 'side',
    subject: 'A1',
    question: { ja: '{A1}は次、どちらからサーブする？', en: 'Where does {A1} serve from next?' },
    // 0-0-2 のスターティングサーバーは「2人目」（5.B.2）。2人目も得点のたびに左右を替える（5.B.6）
    refs: ['5.B.3', '5.B.2', '5.B.6'],
  },
  { id: 'start-sideout', seq: ['A', 'B'], ask: 'call', question: { ja: '次のコールは？', en: 'What is the next call?' }, refs: ['5.B', '6.B.2'] },
  { id: 'first-server', seq: ['A', 'B'], ask: 'server', question: { ja: '次にサーブするのは？', en: 'Who serves next?' }, refs: ['5.B.2'] },
  {
    id: 'receiver',
    seq: ['A', 'B', 'B'],
    ask: 'receiver',
    question: { ja: '次にレシーブするのは？', en: 'Who receives next?' },
    // 自動の説明（「レシーブ側は動きません」）だけだと、レシーバーが替わる理由が伝わらないので足す
    note: {
      ja: '立ち位置は同じでも、レシーブする人は替わります。レシーバーはいつもサーバーの対角に立つ人です。はるとは左からサーブするので、Aチームで左に立つ人が受けます。Aは1点（奇数）なので、スターティングサーバーのあおいが左です。',
      en: "Their positions stay the same, but the receiver changes: the receiver is always diagonally opposite the server. Ken now serves from the left, so Team A's left-side player receives. Team A has 1 point (odd), so its starting server Ava is on the left.",
    },
    refs: ['5.B.3'],
  },
  { id: 'second-server', seq: ['A', 'B', 'B', 'A'], ask: 'call', question: { ja: '次のコールは？', en: 'What is the next call?' }, refs: ['5.B.5'] },
  {
    id: 'even-right',
    seq: rep('A', 4),
    ask: 'side',
    subject: 'A1',
    question: { ja: 'Aチームは4点に。{A1}はどちらに立つ？', en: 'Team A now has 4 points. Which side is {A1} on?' },
    refs: ['5.B.3'],
  },
  {
    id: 'singles-odd',
    format: { kind: 'singles' },
    seq: rep('A', 3),
    ask: 'side',
    subject: 'A1',
    question: { ja: 'シングルス。{A1}は次、どちらからサーブする？', en: 'Singles. Where does {A1} serve from next?' },
    refs: ['5.A.1'],
  },
  {
    id: 'rally-call',
    format: { scoring: 'rally' },
    seq: ['A', 'B'],
    ask: 'call',
    question: { ja: 'ラリー方式。次のコールは？', en: 'Rally scoring. What is the next call?' },
    refs: ['14.A.3'],
  },
  {
    id: 'rally-win',
    format: { scoring: 'rally' },
    seq: [...rep('B', 10), ...rep('A', 5)],
    ask: 'outcome',
    hypo: 'B',
    question: { ja: 'ラリー方式でA 5点・B 10点、Aのサーブ。Bがこのラリーに勝つと？', en: 'Rally scoring, A 5 – B 10, A serving. If B wins this rally?' },
    note: {
      ja: '2026年版から、ラリー方式ではレシーブ側も決勝点を取れるようになりました（2025年までは取れませんでした）。',
      en: 'Since the 2026 rulebook, the receiving side can win the game in rally scoring (it could not until 2025).',
    },
    refs: ['14.A.2', '4.B', 'CD-2242'],
  },
  {
    id: 'end-change',
    seq: [],
    ask: 'endchange',
    question: { ja: '11点のゲームで、エンドを替える目安は？', en: 'In a game to 11, when do players change ends?' },
    note: {
      ja: '大会の1ゲームマッチや最終ゲームでの決まりです。練習では目安として使ってください。サーバーは替わりません。',
      en: 'This is a tournament rule for one-game matches and deciding games; treat it as a guide in casual play. The server does not change.',
    },
    refs: ['21.B.1', '21.B.4'],
  },
]

export const LEARN_NAMES: Record<Lang, Record<PlayerId, string>> = {
  ja: { A1: 'あおい', A2: 'そら', B1: 'はると', B2: 'りん' },
  en: { A1: 'Ava', A2: 'Sam', B1: 'Ken', B2: 'Lily' },
}

export function sceneSetup(scene: Scene, lang: Lang): Setup {
  const format: Format = { kind: 'doubles', scoring: 'sideout', target: 11, winBy: 2, ...scene.format }
  const names = { ...LEARN_NAMES[lang] }
  if (format.kind === 'singles') {
    delete (names as Partial<Record<PlayerId, string>>).A2
    delete (names as Partial<Record<PlayerId, string>>).B2
  }
  return { format, names, startingServer: { A: 'A1', B: 'B1' }, firstServingTeam: 'A', rulesetId: 'usap-2026' }
}

const events = (seq: Team[]): GameEvent[] => seq.map((winner, i) => ({ type: 'rally', winner, at: i }))

const callText = (c: number[]) => c.join('-')

/** 3択の選択肢の id と表示 */
export interface Choice {
  id: string
  label: string
  correct: boolean
}

export interface BuiltScene {
  scene: Scene
  setup: Setup
  /** 問題の時点で見せる状態（このあと起きたことの直前） */
  before: GameState
  beforeView: View
  after: GameState
  situation: string
  question: string
  choices: Choice[]
  answerLabel: string
  explanation: string
  refs: string[]
}

function sideLabel(side: 'right' | 'left' | 'either', lang: Lang): string {
  if (lang === 'en') return side === 'right' ? 'Right' : side === 'left' ? 'Left' : 'Either side'
  return side === 'right' ? '右' : side === 'left' ? '左' : 'どちらでもよい'
}

function outcomeLabel(id: 'win' | 'sideout' | 'continue', team: Team, lang: Lang): string {
  const t = teamLabel(team, lang)
  if (lang === 'en') {
    if (id === 'win') return `${t} wins the game`
    if (id === 'sideout') return 'Side out, no point'
    return `${t} scores, game goes on`
  }
  if (id === 'win') return `${t}の勝ち（ゲーム終了）`
  if (id === 'sideout') return 'サイドアウトだけ（点は入らない）'
  return `${t}に1点、ゲームは続く`
}

/** 正解の id（エンジンで計算） */
export function answerOf(scene: Scene, lang: Lang = 'ja'): string {
  return buildScene(scene, lang, 0).choices.find((c) => c.correct)!.id
}

function wrongCalls(call: number[]): number[][] {
  const out: number[][] = []
  if (call.length === 3) {
    const [s, r, n] = call
    out.push([r, s, n], [s, r, n === 1 ? 2 : 1], [s, r], [s + 1, r, n])
  } else {
    const [s, r] = call
    out.push([r, s], [s, r, 1], [s + 1, r])
  }
  return out
}

/** 文字列からの決定的な乱数（選択肢の並び替え用） */
function seeded(str: string): () => number {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], seed: string): T[] {
  const rnd = seeded(seed)
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function fill(text: string, setup: Setup): string {
  return text.replace(/\{(A1|A2|B1|B2)\}/g, (_, p: PlayerId) => setup.names[p] ?? p)
}

export function buildScene(scene: Scene, lang: Lang, seed: number): BuiltScene {
  const setup = sceneSetup(scene, lang)
  const evs = events(scene.seq)
  let before: GameState
  let after: GameState
  let lastEvent: GameEvent | undefined
  if (scene.ask === 'outcome') {
    before = replay(setup, evs)
    lastEvent = { type: 'rally', winner: scene.hypo ?? 'A', at: evs.length }
    after = applyEvent(before, lastEvent, setup)
  } else if (evs.length) {
    before = replay(setup, evs.slice(0, -1))
    lastEvent = evs[evs.length - 1]
    after = applyEvent(before, lastEvent, setup)
  } else {
    before = initialState(setup)
    after = before
  }
  const beforeView = deriveView(null, before, setup)
  const afterView = deriveView(scene.ask === 'outcome' || evs.length ? before : null, after, setup, lastEvent)

  let correct: { id: string; label: string }
  let wrong: { id: string; label: string }[] = []
  const name = (p: PlayerId) => setup.names[p] ?? p

  switch (scene.ask) {
    case 'call': {
      const c = callText(afterView.call)
      correct = { id: c, label: c }
      wrong = wrongCalls(afterView.call)
        .map(callText)
        .filter((x, i, a) => x !== c && a.indexOf(x) === i)
        .slice(0, 2)
        .map((x) => ({ id: x, label: x }))
      break
    }
    case 'server':
    case 'receiver': {
      const p = scene.ask === 'server' ? afterView.server : afterView.receiver
      correct = { id: p, label: name(p) }
      const order: PlayerId[] = [p === 'A1' ? 'A2' : p === 'A2' ? 'A1' : p === 'B1' ? 'B2' : 'B1', 'A1', 'A2', 'B1', 'B2']
      wrong = order
        .filter((x, i, a) => x !== p && a.indexOf(x) === i && x in setup.names)
        .slice(0, 2)
        .map((x) => ({ id: x, label: name(x) }))
      break
    }
    case 'side': {
      const subject = scene.subject ?? afterView.server
      const s = afterView.positions[subject] ?? 'right'
      correct = { id: s, label: sideLabel(s, lang) }
      wrong = (['right', 'left', 'either'] as const).filter((x) => x !== s).map((x) => ({ id: x, label: sideLabel(x, lang) }))
      break
    }
    case 'outcome': {
      const hypo = scene.hypo ?? 'A'
      const id = after.winner ? 'win' : after.score[hypo] === before.score[hypo] ? 'sideout' : 'continue'
      correct = { id, label: outcomeLabel(id, hypo, lang) }
      wrong = (['win', 'sideout', 'continue'] as const).filter((x) => x !== id).map((x) => ({ id: x, label: outcomeLabel(x, hypo, lang) }))
      break
    }
    case 'endchange': {
      const t = RULESET.endChange[setup.format.target]
      const lab = (k: string) => {
        if (lang === 'en') return k === 'first' ? `When a side first reaches ${t}` : k === 'total' ? `When the total reaches ${t}` : `When a side first reaches ${t - 1}`
        return k === 'first' ? `どちらかが先に${t}点になったとき` : k === 'total' ? `2チームの合計が${t}点になったとき` : `どちらかが先に${t - 1}点になったとき`
      }
      correct = { id: `first-${t}`, label: lab('first') }
      wrong = [
        { id: `total-${t}`, label: lab('total') },
        { id: `first-${t - 1}`, label: lab('minus') },
      ]
      break
    }
  }

  const choices = shuffle(
    [{ ...correct, correct: true }, ...wrong.map((w) => ({ ...w, correct: false }))],
    `${scene.id}:${seed}`,
  )

  const situation = situationOf(scene, lang)
  const key = scene.ask === 'endchange' ? null : explainKeyOf(scene.ask === 'outcome' || evs.length ? before : null, after, setup, lastEvent)
  const auto = key ? RULESET.summaries[key][lang] : ''
  const explanation = [auto, scene.note?.[lang]].filter(Boolean).join(' ')

  return {
    scene,
    setup,
    before,
    beforeView,
    after,
    situation,
    question: fill(scene.question[lang], setup),
    choices,
    answerLabel: correct.label,
    explanation,
    refs: scene.refs,
  }
}

function situationOf(scene: Scene, lang: Lang): string {
  if (scene.ask === 'endchange') return lang === 'ja' ? '11点・2点差のゲームです。' : 'A game to 11, win by 2.'
  if (scene.ask === 'outcome') return ''
  const last = scene.seq[scene.seq.length - 1]
  if (!last) return lang === 'ja' ? 'ゲーム開始。Aチームが最初にサーブします。' : 'Game start. Team A serves first.'
  return lang === 'ja'
    ? `図の場面から、${teamLabel(last, lang)}がラリーに勝ちました。`
    : `From the position shown, ${teamLabel(last, lang)} won the rally.`
}

export type LearnProgress = Record<string, { n: number; ok: number; last: 'ok' | 'ng'; at: number }>

/** 出題順: 前回まちがえた場面（古い順）→ まだ出していない場面 → 最後に出した時刻が古い順。pinned があれば先頭 */
export function orderScenes(progress: LearnProgress, pinnedId?: string): string[] {
  const ids = SCENES.map((s) => s.id)
  const seen = ids.filter((id) => progress[id])
  const wrong = seen.filter((id) => progress[id].last === 'ng').sort((a, b) => progress[a].at - progress[b].at)
  const unseen = ids.filter((id) => !progress[id])
  const okOld = seen.filter((id) => progress[id].last === 'ok').sort((a, b) => progress[a].at - progress[b].at)
  const order = [...wrong, ...unseen, ...okOld]
  if (pinnedId && ids.includes(pinnedId)) return [pinnedId, ...order.filter((id) => id !== pinnedId)]
  return order
}

export function recordAnswer(progress: LearnProgress, id: string, ok: boolean, at: number): LearnProgress {
  const cur = progress[id] ?? { n: 0, ok: 0, last: 'ok' as const, at: 0 }
  return { ...progress, [id]: { n: cur.n + 1, ok: cur.ok + (ok ? 1 : 0), last: ok ? 'ok' : 'ng', at } }
}

export const sceneById = (id: string) => SCENES.find((s) => s.id === id)
