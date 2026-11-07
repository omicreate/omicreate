import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 共通のスタイルを先に読む（各画面のスタイルが、同じ強さの指定なら共通のものに勝つように）
import './design/base.css'
import App from './App'
import { absorbQuery } from './boot'
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
