/**
 * Drizzle-Kit Migration Configuration Template
 *
 * This is a reference template. Copy to your project root as drizzle.config.ts
 * and adapt paths and database URL to your application.
 *
 * Used by drizzle-kit for schema-driven migration generation:
 *   pnpm drizzle-kit generate  — generate migrations from schema changes
 *   pnpm drizzle-kit migrate   — apply pending migrations
 *
 * See data-patterns.md for the full migration standard.
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/shared/src/schema/**/*.ts',
  out: './schema/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
