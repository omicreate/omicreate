import { Guide } from './ui/screens/Guide'
import { History } from './ui/screens/History'
import { Home } from './ui/screens/Home'
import { Learn } from './ui/screens/Learn'
import { Play } from './ui/screens/Play'
import { Result } from './ui/screens/Result'
import { Settings } from './ui/screens/Settings'
import { Setup } from './ui/screens/Setup'
import { useEffect } from 'react'
import { useRoute } from './ui/router'
import { useApp } from './ui/store'

export default function App() {
  const route = useRoute()
  const { t } = useApp()
  // タブの題名を画面ごとに変える（例: 設定 - ピックルコール）。ホームはアプリ名だけ
  useEffect(() => {
    const name = t('app.name')
    const h1 = route.name === 'home' ? '' : (document.querySelector('main h1')?.textContent ?? '').trim()
    document.title = h1 && h1 !== name ? `${h1} - ${name}` : name
  }, [route, t])
  switch (route.name) {
    case 'setup':
      return <Setup />
    case 'play':
      return <Play />
    case 'result':
      return <Result />
    case 'learn':
      return <Learn scene={route.query.get('scene') ?? undefined} />
    case 'guide':
      return <Guide />
    case 'history':
      return <History />
    case 'settings':
      return <Settings />
    default:
      return <Home />
  }
}
