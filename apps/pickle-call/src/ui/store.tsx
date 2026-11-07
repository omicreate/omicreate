// アプリ全体の状態（設定・進行中のゲーム・履歴・学ぶの進み具合）と操作。
// ゲームの状態は保存せず、イベント列から毎回作り直す（取り消しが正確になる）。毎操作の直後に保存する。
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { nextGameSetup, replay } from '../domain/engine'
import { formatCode } from '../domain/format'
import { recordAnswer } from '../domain/learn'
import type { LearnProgress } from '../domain/learn'
import { gameText, voiceText } from '../domain/speech-text'
import type { GameEvent, GameState, Lang, PlayerId, SetEvent, Setup, Team, View } from '../domain/types'
import { viewFromEvents } from '../domain/view'
import { track } from '../infra/counter'
import { createSpeaker } from '../infra/speech'
import { clearAll as clearStorage, isObj, load, save, upsertRecord } from '../infra/storage'
import { acquireWakeLock, releaseWakeLock } from '../infra/wakelock'
import { makeT } from '../i18n'
import type { T } from '../i18n'

export interface Settings {
  lang: Lang
  voice: boolean
  rate: number
  numStyle: 'kana' | 'ja'
  highContrast: boolean
  theme: 'auto' | 'light' | 'dark'
  wakeLock: boolean
  keepNames: boolean
  counter: boolean
}

export interface Current {
  id: string
  setup: Setup
  events: GameEvent[]
  startedAt: number
  flipped: boolean
}

export interface GameRecord {
  id: string
  startedAt: number
  endedAt: number
  format: Setup['format']
  names?: Setup['names']
  score: Record<Team, number>
  winner: Team
  rallies: number
  sideOuts: number
  rulesetId: Setup['rulesetId']
}

export type FixInput = Omit<SetEvent, 'type' | 'at'>

export interface Game {
  prev: GameState | null
  state: GameState
  view: View
}

export function defaultLang(): Lang {
  try {
    return (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en'
  } catch {
    return 'ja'
  }
}

export const defaultSettings = (): Settings => ({
  lang: defaultLang(),
  voice: true,
  rate: 1,
  numStyle: 'kana',
  highContrast: false,
  theme: 'auto',
  wakeLock: true,
  keepNames: true,
  counter: true,
})

// ---- 読み込んだ値の検査（壊れていたら既定値に戻す） ----
const isTeam = (x: unknown): x is Team => x === 'A' || x === 'B'
const isPlayer = (x: unknown): x is PlayerId => x === 'A1' || x === 'A2' || x === 'B1' || x === 'B2'
export function isSetup(x: unknown): x is Setup {
  if (!isObj(x) || !isObj(x.format) || !isObj(x.startingServer) || !isObj(x.names)) return false
  return (
    isFormat(x.format) &&
    isPlayer(x.startingServer.A) &&
    isPlayer(x.startingServer.B) &&
    isTeam(x.firstServingTeam) &&
    x.rulesetId === 'usap-2026' &&
    Object.values(x.names).every((v) => typeof v === 'string')
  )
}
function isEvent(x: unknown): x is GameEvent {
  if (!isObj(x) || typeof x.at !== 'number') return false
  if (x.type === 'rally') return isTeam(x.winner)
  if (x.type === 'set')
    return (
      isObj(x.score) &&
      isTeam(x.servingTeam) &&
      isPlayer(x.server) &&
      isObj(x.startingServer) &&
      isPlayer(x.startingServer.A) &&
      isPlayer(x.startingServer.B)
    )
  return false
}
export function isCurrent(x: unknown): x is Current {
  return (
    isObj(x) &&
    typeof x.id === 'string' &&
    isSetup(x.setup) &&
    Array.isArray(x.events) &&
    x.events.length <= 2000 &&
    x.events.every(isEvent) &&
    typeof x.startedAt === 'number'
  )
}
function isSettings(x: unknown): x is Settings {
  return isObj(x) && (x.lang === 'ja' || x.lang === 'en') && typeof x.voice === 'boolean' && typeof x.rate === 'number'
}
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
function isFormat(f: unknown): f is Setup['format'] {
  return (
    isObj(f) &&
    (f.kind === 'doubles' || f.kind === 'singles') &&
    (f.scoring === 'sideout' || f.scoring === 'rally') &&
    (f.target === 11 || f.target === 15 || f.target === 21) &&
    (f.winBy === 1 || f.winBy === 2)
  )
}
/** 履歴の1件。壊れた1件があっても、ほかの記録は捨てない（読み込むときに1件ずつ選り分ける） */
export function isRecord(r: unknown): r is GameRecord {
  return (
    isObj(r) &&
    typeof r.id === 'string' &&
    isTeam(r.winner) &&
    isNum(r.startedAt) &&
    isNum(r.endedAt) &&
    isNum(r.rallies) &&
    isNum(r.sideOuts) &&
    isObj(r.score) &&
    isNum(r.score.A) &&
    isNum(r.score.B) &&
    isFormat(r.format) &&
    (r.names === undefined || (isObj(r.names) && Object.values(r.names).every((v) => typeof v === 'string')))
  )
}
const isLearn = (x: unknown): x is LearnProgress => isObj(x) && Object.values(x).every((v) => isObj(v) && typeof v.at === 'number')

interface Ctx {
  settings: Settings
  setSettings: (patch: Partial<Settings>) => void
  lang: Lang
  t: T
  current: Current | null
  game: Game | null
  lastSetup: Setup | null
  history: GameRecord[]
  learn: LearnProgress
  speechOk: boolean
  actions: {
    startGame: (setup: Setup) => void
    rally: (winner: Team) => boolean
    undo: () => void
    fix: (input: FixInput) => void
    toggleFlip: () => void
    quit: () => void
    nextGame: () => void
    speakAgain: () => void
    speak: (text: string) => void
    recordLearn: (id: string, ok: boolean) => void
    learnFinished: () => void
    shared: () => void
    clearHistory: () => void
    clearAll: () => void
  }
}

const AppContext = createContext<Ctx | null>(null)

export function useApp(): Ctx {
  const c = useContext(AppContext)
  if (!c) throw new Error('useApp must be used inside <AppProvider>')
  return c
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** 連打を無視する間隔（ミリ秒） */
export const RALLY_GUARD_MS = 300

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(() => ({ ...defaultSettings(), ...load('settings', defaultSettings(), isSettings) }))
  const [current, setCurrent] = useState<Current | null>(() => load('current', null, (x): x is Current | null => x === null || isCurrent(x)))
  const [lastSetup, setLastSetup] = useState<Setup | null>(() => load('lastSetup', null, (x): x is Setup | null => x === null || isSetup(x)))
  const [history, setHistory] = useState<GameRecord[]>(() => load<unknown[]>('history', [], Array.isArray).filter(isRecord))
  const [learn, setLearn] = useState<LearnProgress>(() => load('learn', {}, isLearn))

  const speaker = useMemo(() => createSpeaker(), [])
  const speechOk = speaker.supported()
  const currentRef = useRef(current)
  currentRef.current = current
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const historyRef = useRef(history)
  historyRef.current = history
  const lastRallyAt = useRef(-Infinity)
  const finishedIds = useRef(new Set<string>())

  const t = useMemo(() => makeT(settings.lang), [settings.lang])

  // 言語・表示の設定を <html> に反映する。描く前に当てる（読み込み直後に別の色や言語で一瞬描かれないように）
  useLayoutEffect(() => {
    const el = document.documentElement
    el.lang = settings.lang
    if (settings.theme === 'auto') el.removeAttribute('data-theme')
    else el.setAttribute('data-theme', settings.theme)
    if (settings.highContrast) el.setAttribute('data-contrast', 'high')
    else el.removeAttribute('data-contrast')
    // ブラウザの上の帯（theme-color）も、アプリで選んだ明るさに合わせる。「端末に合わせる」なら元の media 別の値に戻す
    const bar = settings.highContrast ? '#ffffff' : settings.theme === 'dark' ? '#0f1318' : settings.theme === 'light' ? '#fafaf7' : null
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      m.content = bar ?? (m.media.includes('dark') ? '#0f1318' : '#fafaf7')
    })
    // iOS の「ホーム画面に追加」で付く名前も、表示の言語に合わせる
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', t('app.name'))
    // タブの題名は画面ごとに App が決める
  }, [settings.lang, settings.theme, settings.highContrast, t])

  useEffect(() => {
    track(settings.counter, 'open')
    // 起動時の1回だけでよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setSettings = useCallback(
    (patch: Partial<Settings>) => {
      // 読み上げをオフにしたら、いま読んでいる文もすぐ止める
      if (patch.voice === false) speaker.cancel()
      setSettingsState((s) => {
        const next = { ...s, ...patch }
        save('settings', next)
        return next
      })
    },
    [speaker],
  )

  const speak = useCallback(
    (text: string) => {
      const s = settingsRef.current
      if (!s.voice || !text) return
      speaker.speak(text, s.lang, s.rate)
    },
    [speaker],
  )

  const announce = useCallback(
    (cur: Current, game: Game) => {
      const s = settingsRef.current
      const text = game.state.winner ? gameText(game.state, cur.setup, s.lang, s.numStyle) : voiceText(game.view, cur.setup, s.lang, s.numStyle)
      speak(text)
    },
    [speak],
  )

  /** 進行中のゲームを書き換え、保存し、履歴と計測をそろえる */
  const commit = useCallback((cur: Current | null) => {
    const before = currentRef.current
    currentRef.current = cur
    setCurrent(cur)
    save('current', cur)
    if (!cur) return null
    const game = viewFromEvents(cur.setup, cur.events)
    const s = settingsRef.current
    let hist = historyRef.current
    if (game.state.winner) {
      const rec: GameRecord = {
        id: cur.id,
        startedAt: cur.startedAt,
        endedAt: cur.events[cur.events.length - 1]?.at ?? Date.now(),
        format: cur.setup.format,
        names: s.keepNames ? cur.setup.names : undefined,
        score: game.state.score,
        winner: game.state.winner,
        rallies: game.state.rallies,
        sideOuts: game.state.sideOuts,
        rulesetId: cur.setup.rulesetId,
      }
      // 決着したところなら残す。すでに決着していたゲームは、記録がまだあるときだけ書き直す
      // （履歴を消した後に、決着したゲームを直しても記録を生き返らせない）
      const known = hist.some((r) => r.id === cur.id)
      const wasOver = !!before && before.id === cur.id && viewFromEvents(before.setup, before.events).state.winner !== null
      if (known || !wasOver) hist = upsertRecord(hist, rec)
      if (!finishedIds.current.has(cur.id)) {
        finishedIds.current.add(cur.id)
        track(s.counter, 'finish', formatCode(cur.setup.format))
      }
    } else if (hist.some((r) => r.id === cur.id)) {
      // 決着の後に「1手戻す」をしたら、履歴からも外す
      hist = hist.filter((r) => r.id !== cur.id)
    }
    if (hist !== historyRef.current) {
      historyRef.current = hist
      setHistory(hist)
      save('history', hist)
    }
    return game
  }, [])

  const begin = useCallback(
    (setup: Setup) => {
      const cur: Current = { id: newId(), setup, events: [], startedAt: Date.now(), flipped: currentRef.current?.flipped ?? false }
      setLastSetup(setup)
      save('lastSetup', setup)
      const game = commit(cur)
      // iOS: クリックの処理の中で同期的に読み上げを始める
      if (game) announce(cur, game)
      if (settingsRef.current.wakeLock) acquireWakeLock()
      track(settingsRef.current.counter, 'start', formatCode(setup.format))
      lastRallyAt.current = -Infinity
    },
    [announce, commit],
  )

  const actions = useMemo<Ctx['actions']>(
    () => ({
      startGame: begin,
      rally(winner) {
        const cur = currentRef.current
        if (!cur) return false
        const now = performance.now()
        if (now - lastRallyAt.current < RALLY_GUARD_MS) return false
        const before = viewFromEvents(cur.setup, cur.events)
        if (before.state.winner) return false
        lastRallyAt.current = now
        const next: Current = { ...cur, events: [...cur.events, { type: 'rally', winner, at: Date.now() }] }
        const game = commit(next)
        if (game) announce(next, game)
        try {
          navigator.vibrate?.(10)
        } catch {
          // 振動に対応していなくてよい
        }
        return true
      },
      undo() {
        const cur = currentRef.current
        if (!cur || !cur.events.length) return
        const next: Current = { ...cur, events: cur.events.slice(0, -1) }
        const game = commit(next)
        // エンドチェンジの目安はゲームに1回だけ。取り消しで戻ってきた場面では、もう一度は言わない（表示の印はそのまま）
        if (game) announce(next, { ...game, view: { ...game.view, endChangeNow: false } })
      },
      fix(input) {
        const cur = currentRef.current
        if (!cur) return
        const next: Current = { ...cur, events: [...cur.events, { type: 'set', ...input, at: Date.now() }] }
        const game = commit(next)
        if (game) announce(next, game)
      },
      toggleFlip() {
        // 見た目だけの切り替え。点数も履歴も変えない
        const cur = currentRef.current
        if (!cur) return
        const next: Current = { ...cur, flipped: !cur.flipped }
        currentRef.current = next
        setCurrent(next)
        save('current', next)
      },
      quit() {
        commit(null)
        releaseWakeLock()
        speaker.cancel()
      },
      nextGame() {
        const cur = currentRef.current
        if (!cur) return
        // 「スコアを直す」で直したスターティングサーバーも引き継ぐ（設定そのものは取り消しの再計算に使うので書き換えない）
        begin(nextGameSetup(cur.setup, replay(cur.setup, cur.events).startingServer))
      },
      speakAgain() {
        const cur = currentRef.current
        if (!cur) return
        announce(cur, viewFromEvents(cur.setup, cur.events))
      },
      speak,
      recordLearn(id, ok) {
        setLearn((p) => {
          const next = recordAnswer(p, id, ok, Date.now())
          save('learn', next)
          return next
        })
      },
      learnFinished() {
        track(settingsRef.current.counter, 'finish', 'learn')
      },
      shared() {
        track(settingsRef.current.counter, 'share', 'result')
      },
      clearHistory() {
        historyRef.current = []
        setHistory([])
        save('history', [])
      },
      clearAll() {
        clearStorage()
        releaseWakeLock()
        currentRef.current = null
        historyRef.current = []
        setCurrent(null)
        setLastSetup(null)
        setHistory([])
        setLearn({})
        setSettingsState(defaultSettings())
      },
    }),
    [announce, begin, commit, speak, speaker],
  )

  const game = useMemo(() => (current ? viewFromEvents(current.setup, current.events) : null), [current])

  const value: Ctx = {
    settings,
    setSettings,
    lang: settings.lang,
    t,
    current,
    game,
    lastSetup,
    history,
    learn,
    speechOk,
    actions,
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
