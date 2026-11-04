import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:5175', browserName: 'chromium' },
  timeout: 60_000,
  workers: 1,
  webServer: [
    {
      command: 'npm run start -w @partypick/api',
      url: 'http://127.0.0.1:3003/api/health',
      env: {
        PORT: '3003',
        PGLITE_DATA_DIR: 'memory://',
        PUBLIC_ORIGIN: 'http://127.0.0.1:5175',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -w @partypick/web -- --port 5175',
      url: 'http://127.0.0.1:5175',
      env: { API_ORIGIN: 'http://127.0.0.1:3003' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
