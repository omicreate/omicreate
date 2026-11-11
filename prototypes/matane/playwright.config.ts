import { defineConfig, devices } from '@playwright/test'

// The preview server port. Playwright derives baseURL from it, so no host name is written here.
const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Pixel 7'],
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'off',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    port: PORT,
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
