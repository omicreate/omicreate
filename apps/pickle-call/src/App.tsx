import { Guide } from './ui/screens/Guide'
import { History } from './ui/screens/History'
import { Home } from './ui/screens/Home'
import { Learn } from './ui/screens/Learn'
import { Play } from './ui/screens/Play'
import { Result } from './ui/screens/Result'
import { Settings } from './ui/screens/Settings'
import { Setup } from './ui/screens/Setup'
import { useRoute } from './ui/router'

export default function App() {
  const route = useRoute()
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
