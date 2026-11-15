import { defineConfig } from '@playwright/test';

// Used only by the isolated production Compose job with internal TLS.
export default defineConfig({
  testDir: './tests/production',
  use: {
    baseURL: 'https://localhost:8443',
    browserName: 'chromium',
    ignoreHTTPSErrors: true,
  },
  timeout: 240_000,
  workers: 1,
});
