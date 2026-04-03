import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/stores/__tests__/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/.worktrees/**',
      '**/dist/**',
      '**/archived-tests/analyze.improved.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});