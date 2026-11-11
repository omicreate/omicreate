import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * 外への通信を作らないための Content-Security-Policy（ビルドしたときだけ index.html に入れる）。
 * 開発サーバーは HMR のためにインラインのスクリプトを使うので、ここでは入れない。
 */
const CSP = [
  "default-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function cspOnBuild(): Plugin {
  return {
    name: 'matane-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ],
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    cspOnBuild(),
    VitePWA({
      registerType: 'autoUpdate',
      // 登録は src/main.tsx の virtual:pwa-register で行う（インラインのスクリプトを入れない）
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'またね帳',
        short_name: 'またね帳',
        description: '個人美容師のための再来ノート。記録はこの端末の中だけ。',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f6f9',
        theme_color: '#2f5d8a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        // 初めて開いたページもすぐ Service Worker の受け持ちにする（一度読み込めばオフラインで動くように）
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
})
