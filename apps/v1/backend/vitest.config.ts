import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 60000, // E2E tests with embedding are slow
    hookTimeout: 60000,
    teardownTimeout: 30000,
  },
});
