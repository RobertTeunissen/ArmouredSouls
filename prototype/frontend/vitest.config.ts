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
    pool: 'forks',
    forks: {
      maxForks: process.env.CI ? 1 : undefined,
      execArgv: process.env.CI ? ['--max-old-space-size=1024'] : [],
    },
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
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
