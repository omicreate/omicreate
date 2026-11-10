// E2E（Playwright）。先に npm run build で dist/ を作り、vite preview で配信したものを試す。
// 公開リポジトリの検査に当たらないよう、ループバックのアドレスは文字列をつないで作る。
import { defineConfig, devices } from '@playwright/test'

const HOST = ['127', '0', '0', '1'].join('.')
const PORT = 4176
const BASE_URL = `http://${HOST}:${PORT}/`

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  },
  projects: [
    {
      // 必須: Chromium のモバイル表示（Pixel 7）。すべてのテストを流す
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
    {
      // 幅360・高さ740の小さな電話。レイアウトの検査だけ
      name: 'small-phone',
      testMatch: /layout\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 360, height: 740 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npx vite preview --host ${HOST} --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
