import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/vitest.setup.ts'],
    exclude: ['tests/e2e/**', '**/node_modules/**', '**/.claude/**', '**/.worktrees/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'lib/**/*.tsx', 'components/**/*.ts', 'components/**/*.tsx'],
    },
  },
});
