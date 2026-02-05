import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/crawler': path.resolve(__dirname, './src/crawler'),
      '@/analyzers': path.resolve(__dirname, './src/analyzers'),
      '@/visual-regression': path.resolve(__dirname, './src/visual-regression'),
      '@/recommendations': path.resolve(__dirname, './src/recommendations'),
      '@/reporters': path.resolve(__dirname, './src/reporters'),
      '@/ci-integration': path.resolve(__dirname, './src/ci-integration'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    },
  },
});
