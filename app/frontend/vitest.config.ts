import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/dist/**',
      ],
      // Enforced in CI through `pnpm run test:ci`. Floors sit about two points
      // under the measured values (9 Nov 2026, after the untested-component
      // passes: statements 81.7%, branches 74.8%, functions 83.4%, lines 83.9%)
      // so a change that drops coverage fails.
      thresholds: {
        statements: 80,
        branches: 73,
        functions: 81,
        lines: 82,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
