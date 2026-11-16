import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup-env.ts'],
    globalSetup: ['src/test/global-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }, // one MongoDB instance shared across test files
    isolate: false, // singleton mongoose models cannot be re-compiled per file
  },
});
