import { defineConfig } from 'vitest/config';
import { frontendAliases } from './config/frontend-aliases';

export default defineConfig({
  resolve: { alias: frontendAliases },
  test: {
    include: [
      'apps/**/*.test.ts',
      'apps/**/*.test.tsx',
      'packages/**/*.test.ts',
    ],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
