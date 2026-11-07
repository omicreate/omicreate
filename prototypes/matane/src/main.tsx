import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './styles.css'

// オフラインで動くよう Service Worker を登録する。新しい版があれば自動で入れ替える
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(<App />)
