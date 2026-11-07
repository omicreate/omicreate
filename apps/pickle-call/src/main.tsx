import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { absorbQuery } from './boot'
import './design/base.css'
import { AppProvider } from './ui/store'

absorbQuery()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)

// PWA: 本番ビルドで、https（または開発用の自分の端末）のときだけ Service Worker を登録する
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext && !import.meta.env.VITE_NO_SW) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
