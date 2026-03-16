/**
 * Vitest Configuration Template
 *
 * This is a reference template. Copy to your project root as vitest.config.ts
 * and adapt paths and settings to your application.
 *
 * Vitest is the standard test runner for unit and integration tests.
 * See testing.md for the full testing standard.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Discover test files across the monorepo
    include: [
      'apps/*/src/**/*.test.ts',
      'packages/*/src/**/*.test.ts',
    ],

    // TypeScript support via native ESM
    globals: true,

    // Test environment
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      include: [
        'apps/*/src/**/*.ts',
        'packages/*/src/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
      ],
    },
  },
});
