// アプリ全体の状態（設定・進行中のゲーム・履歴・学ぶの進み具合）と操作。
// ゲームの状態は保存せず、イベント列から毎回作り直す（取り消しが正確になる）。毎操作の直後に保存する。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { nextGameSetup } from '../domain/engine'
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
  const f = x.format
  return (
    (f.kind === 'doubles' || f.kind === 'singles') &&
    (f.scoring === 'sideout' || f.scoring === 'rally') &&
    (f.target === 11 || f.target === 15 || f.target === 21) &&
    (f.winBy === 1 || f.winBy === 2) &&
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
  if (x.type === 'set') return isObj(x.score) && isTeam(x.servingTeam) && isPlayer(x.server) && isObj(x.startingServer)
  return false
}
function isCurrent(x: unknown): x is Current {
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
const isHistory = (x: unknown): x is GameRecord[] =>
  Array.isArray(x) && x.every((r) => isObj(r) && typeof r.id === 'string' && isTeam(r.winner) && isObj(r.score))
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
  const [history, setHistory] = useState<GameRecord[]>(() => load('history', [], isHistory))
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

  // 言語・表示の設定を <html> に反映する
  useEffect(() => {
    const el = document.documentElement
    el.lang = settings.lang
    if (settings.theme === 'auto') el.removeAttribute('data-theme')
    else el.setAttribute('data-theme', settings.theme)
    if (settings.highContrast) el.setAttribute('data-contrast', 'high')
    else el.removeAttribute('data-contrast')
    document.title = t('app.name')
  }, [settings.lang, settings.theme, settings.highContrast, t])

  useEffect(() => {
    track(settings.counter, 'open')
    // 起動時の1回だけでよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((s) => {
      const next = { ...s, ...patch }
      save('settings', next)
      return next
    })
  }, [])

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
      const text = game.state.winner ? gameText(game.state, cur.setup, s.lang) : voiceText(game.view, cur.setup, s.lang, s.numStyle)
      speak(text)
    },
    [speak],
  )

  /** 進行中のゲームを書き換え、保存し、履歴と計測をそろえる */
  const commit = useCallback((cur: Current | null) => {
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
      hist = upsertRecord(hist, rec)
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
        if (game) announce(next, game)
      },
      fix(input) {
        const cur = currentRef.current
        if (!cur) return
        const next: Current = { ...cur, events: [...cur.events, { type: 'set', ...input, at: Date.now() }] }
        const game = commit(next)
        if (game) announce(next, game)
      },
      toggleFlip() {
        const cur = currentRef.current
        if (!cur) return
        commit({ ...cur, flipped: !cur.flipped })
      },
      quit() {
        commit(null)
        releaseWakeLock()
        speaker.cancel()
      },
      nextGame() {
        const cur = currentRef.current
        if (!cur) return
        begin(nextGameSetup(cur.setup))
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
