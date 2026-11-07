import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'またね帳',
        short_name: 'またね帳',
        description: '個人美容師のための再来ノート。記録はこの端末の中だけ。',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f8fb',
        theme_color: '#2f5d8a',
        icons: [],
      },
    }),
  ],
})
