/**
 * またね帳の画面の入口。ルーティングはハッシュ（依存なし）。下のタブ［ホーム］［お客様］［ボード］［設定］。
 * サンプル表示中は全画面の上部に「サンプル表示中」の帯を出す（4.0）。
 */
import { useEffect, type ReactNode } from 'react'
import { PROD_DB, requestPersistentStorage, restoreFromPayload } from './storage'
import { AppProvider, useApp } from './state/AppState'
import { FeedbackProvider } from './state/feedback'
import { LockProvider, useLock } from './state/lock'
import { navigate, useRoute, type Route } from './state/router'
import { nowISO } from './state/today'
import { SampleBand, StorageBand, TabBar, type TabKey } from './ui/components/Chrome'
import { RestoreForm } from './ui/components/RestoreForm'
import { Batch } from './ui/screens/Batch'
import { Board } from './ui/screens/Board'
import { BulkRegister } from './ui/screens/BulkRegister'
import { CustomerCard } from './ui/screens/CustomerCard'
import { CustomerList } from './ui/screens/CustomerList'
import { Home } from './ui/screens/Home'
import { Koekake } from './ui/screens/Koekake'
import { LockScreen } from './ui/screens/LockScreen'
import { Onboarding, OnboardingWizard } from './ui/screens/Onboarding'
import { Settings } from './ui/screens/Settings'
import { VisitForm } from './ui/screens/VisitForm'
import type { DbName } from './storage'

export function App({ initialDb }: { initialDb?: DbName } = {}) {
  return (
    <AppProvider initialDb={initialDb}>
      <FeedbackProvider>
        <LockProvider>
          <Shell />
        </LockProvider>
      </FeedbackProvider>
    </AppProvider>
  )
}

function tabOf(route: Route): TabKey | null {
  switch (route.path[0]) {
    case undefined:
    case 'visit':
    case 'batch':
    case 'koekake':
      return 'home'
    case 'customers':
    case 'customer':
    case 'bulk':
      return 'customers'
    case 'board':
      return 'board'
    case 'settings':
      return 'settings'
    default:
      return null
  }
}

function Screen({ route }: { route: Route }) {
  const [head, arg] = route.path
  switch (head) {
    case undefined:
      return <Home />
    case 'visit':
      return <VisitForm key={route.hash} editId={arg} params={route.params} />
    case 'batch':
      return <Batch />
    case 'koekake':
      return arg ? <Koekake key={route.hash} id={arg} params={route.params} /> : <Home />
    case 'customer':
      return arg ? <CustomerCard key={arg} id={arg} /> : <CustomerList params={route.params} />
    case 'customers':
      return <CustomerList params={route.params} />
    case 'bulk':
      return <BulkRegister />
    case 'board':
      return <Board />
    case 'settings':
      return <Settings key={arg ?? 'index'} section={arg} />
    default:
      return <Home />
  }
}

function Shell() {
  const app = useApp()
  const lock = useLock()
  const route = useRoute()
  const pathKey = route.path.join('/')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathKey])

  let body: ReactNode
  if (app.status === 'error') {
    body = <LoadError />
  } else if (app.status === 'loading' || !app.repo) {
    body = (
      <div className="splash" role="status">
        読み込んでいます…
      </div>
    )
  } else if (!app.data.settings) {
    body = <Onboarding />
  } else if (app.onboarding) {
    body = <OnboardingWizard step={app.onboarding} />
  } else {
    body = (
      <>
        <Screen route={route} />
        <TabBar active={tabOf(route)} />
      </>
    )
  }

  return (
    <>
      <div className="app" inert={lock.locked || undefined} aria-hidden={lock.locked || undefined}>
        {app.isSample && app.status === 'ready' && <SampleBand />}
        {app.fallback && <StorageBand />}
        {body}
      </div>
      {lock.locked && <LockScreen />}
    </>
  )
}

function LoadError() {
  const app = useApp()
  return (
    <main className="screen screen-plain stack">
      <h1 className="title">読み込めませんでした</h1>
      <button type="button" className="btn btn-primary btn-block" onClick={() => void app.openDb(app.dbName)}>
        もう一度
      </button>
      <p className="muted">
        直らないときは、ブラウザを開き直してからもう一度お試しください。それでも開けないときは、バックアップのファイルから戻せます。
      </p>
      <div className="card">
        <RestoreForm
          onPayload={async (payload) => {
            await app.openDb(PROD_DB, (repo) => restoreFromPayload(repo, payload, nowISO()))
            void requestPersistentStorage()
            navigate('#/', { replace: true })
          }}
        />
      </div>
    </main>
  )
}
