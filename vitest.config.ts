import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
    deps: {
      inline: ['preact'],
    },
    reporters: ['default', 'json', 'verbose'],
    outputFile: {
      json: './test-results/results.json'
    },
    logHeapUsage: true,
    slowTestThreshold: 1000,
  },
});
