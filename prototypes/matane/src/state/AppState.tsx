/**
 * アプリ全体の状態: 保存層を開く・読み込む・書き込みのたびに読み直す・データベースを切り替える。
 * 起動時は openRepositoryOrMemory と prepareOnStartup を呼ぶ（4.1・6.1）。
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect, type ReactNode } from 'react'
import type { ISODate, Settings } from '../domain'
import {
  getActiveDbName,
  openRepositoryOrMemory,
  prepareOnStartup,
  setActiveDbName,
  SAMPLE_DB,
  type AppData,
  type DbName,
  type Repository,
} from '../storage'
import { currentToday, nowISO, useToday } from './today'

/** S0 の［自分のお客様で始める］のあとの手順（途中で閉じても続きから始める） */
export type OnboardingStep = 'name' | 'links' | 'menus'
export const ONBOARDING_DRAFT = 'onboarding'

const EMPTY_DATA: AppData = {
  customers: [],
  visits: [],
  menus: [],
  contacts: [],
  templates: [],
  settings: null,
  counters: null,
}

export interface AppContextValue {
  status: 'loading' | 'ready' | 'error'
  dbName: DbName
  isSample: boolean
  /** IndexedDB が使えずメモリ保存にしている */
  fallback: boolean
  data: AppData
  today: ISODate
  /** 開いた回数（データベースを開き直すたびに増える。ロックの判定に使う） */
  openCount: number
  onboarding: OnboardingStep | null
  /** 今の Repository（開いていなければ null） */
  repo: Repository | null
  reload: () => Promise<void>
  /** 書き込んで読み直す */
  mutate: <T>(fn: (repo: Repository) => Promise<T>) => Promise<T>
  /** データベースを開き直す（切り替え・すべて消したあと）。beforeLoad で中身を入れられる */
  openDb: (name: DbName, beforeLoad?: (repo: Repository) => Promise<void>) => Promise<void>
  setOnboarding: (step: OnboardingStep | null) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

interface State {
  status: 'loading' | 'ready' | 'error'
  dbName: DbName
  fallback: boolean
  data: AppData
  onboarding: OnboardingStep | null
  openCount: number
}

export function AppProvider({ children, initialDb }: { children: ReactNode; initialDb?: DbName }) {
  const today = useToday()
  const repoRef = useRef<Repository | null>(null)
  const [state, setState] = useState<State>(() => ({
    status: 'loading',
    dbName: initialDb ?? getActiveDbName(),
    fallback: false,
    data: EMPTY_DATA,
    onboarding: null,
    openCount: 0,
  }))

  const openDb = useCallback(async (name: DbName, beforeLoad?: (repo: Repository) => Promise<void>) => {
    setState((s) => ({ ...s, status: 'loading', dbName: name }))
    try {
      const old = repoRef.current
      repoRef.current = null
      if (old) {
        try {
          await old.flush()
        } catch {
          // 書き込みの失敗はここでは扱わない
        }
        old.close()
      }
      setActiveDbName(name)
      const { repo, fallback } = await openRepositoryOrMemory({ dbName: name })
      if (beforeLoad) await beforeLoad(repo)
      const { data } = await prepareOnStartup(repo, { today: currentToday(), now: nowISO() })
      let onboarding: OnboardingStep | null = null
      if (!repo.isSample && data.settings) {
        const d = await repo.getDraft(ONBOARDING_DRAFT)
        const step = (d?.data as { step?: OnboardingStep } | undefined)?.step
        if (step === 'name' || step === 'links' || step === 'menus') onboarding = step
      }
      repoRef.current = repo
      setState((s) => ({ status: 'ready', dbName: name, fallback, data, onboarding, openCount: s.openCount + 1 }))
    } catch {
      setState((s) => ({ ...s, status: 'error' }))
    }
  }, [])

  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void openDb(state.dbName)
  }, [openDb, state.dbName])

  const reload = useCallback(async () => {
    const repo = repoRef.current
    if (!repo) return
    try {
      const data = await repo.loadAll()
      if (repoRef.current === repo) setState((s) => ({ ...s, data, status: 'ready' }))
    } catch {
      setState((s) => ({ ...s, status: 'error' }))
    }
  }, [])

  const mutate = useCallback(
    async <T,>(fn: (repo: Repository) => Promise<T>): Promise<T> => {
      const repo = repoRef.current
      if (!repo) throw new Error('保存先が開いていません')
      try {
        return await fn(repo)
      } finally {
        await reload()
      }
    },
    [reload],
  )

  const setOnboarding = useCallback(async (step: OnboardingStep | null) => {
    const repo = repoRef.current
    if (repo) {
      if (step) await repo.putDraft(ONBOARDING_DRAFT, { step })
      else await repo.deleteDraft(ONBOARDING_DRAFT)
    }
    setState((s) => ({ ...s, onboarding: step }))
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      status: state.status,
      dbName: state.dbName,
      isSample: state.dbName === SAMPLE_DB,
      fallback: state.fallback,
      data: state.data,
      today,
      openCount: state.openCount,
      onboarding: state.onboarding,
      repo: repoRef.current,
      reload,
      mutate,
      openDb,
      setOnboarding,
    }),
    [state, today, reload, mutate, openDb, setOnboarding],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('AppProvider の外では使えません')
  return ctx
}

/** S0 のあとの画面で使う（設定は必ずある） */
export function useSettings(): Settings {
  const s = useApp().data.settings
  if (!s) throw new Error('設定がまだありません')
  return s
}
