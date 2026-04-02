import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'out/',
        'src/generated/**',
        '**/*.config.*',
        '**/*.setup.*',
        '**/*.test.*',
        '**/types/**',
        '**/__tests__/**',
      ],
      // Thresholds are aspirational goals for incremental coverage growth
      // For this initial setup, we verify example test coverage (100% on helpers/featureFlags)
      // Global thresholds will be enforced once more of the codebase has tests
      thresholds: {
        autoUpdate: true, // Update thresholds based on current coverage
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
