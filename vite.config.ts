import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The site is published as a GitHub project site, so every asset URL is nested
// under the repository name. Browser tests run against this same base.
export default defineConfig({
  base: '/decision-lab/',
  plugins: [react()],
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Browser tests live in tests/e2e and run under Playwright, never Vitest.
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
});
