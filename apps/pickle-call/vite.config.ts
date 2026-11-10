import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 相対パスで出力する。GitHub Pages の /pickle-call/ でも、ほかの置き場所でも同じビルドで動く（画面はハッシュで切り替える）
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'node',
    // e2e/ は Playwright（npm run test:e2e）で動かす
    include: ['src/**/*.test.ts'],
  },
})
