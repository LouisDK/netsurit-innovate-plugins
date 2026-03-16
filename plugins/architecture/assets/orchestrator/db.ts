/**
 * Drizzle ORM Database Client Template
 *
 * This is a reference template. Copy to apps/orchestrator/src/lib/db.ts
 * and adapt to your application's database needs.
 *
 * Features:
 * - Drizzle ORM client wrapping a pg Pool via drizzle(pool)
 * - Lazy singleton initialization
 * - Typed query execution
 * - Transaction helper with proper error handling
 * - Health check returning { ok, latencyMs, error? }
 * - Graceful shutdown
 *
 * Note: The Drizzle client wraps the pg Pool — it does not replace it.
 * Database access belongs in the orchestrator, not in shared/.
 */

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { getConfig } from './config';
import * as schema from '@{app-name}/shared/schema';

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

export function initDb(): NodePgDatabase<typeof schema> {
  if (db) return db;

  const config = getConfig();
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err.message);
  });

  db = drizzle(pool, { schema });
  return db;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    return initDb();
  }
  return db;
}

/**
 * Execute a function within a database transaction.
 * Automatically handles rollback on error.
 *
 * The transaction object supports the same query methods as the db client
 * (select, insert, update, delete) but executes within a transaction scope.
 */
export async function withTransaction<T>(
  fn: (tx: Parameters<Parameters<NodePgDatabase<typeof schema>['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    return fn(tx);
  });
}

/**
 * Check database connectivity for readiness probes.
 */
export async function healthCheck(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await getDb().execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully close the pool. Call during server shutdown.
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

// ============================================================================
// Usage Examples
// ============================================================================
/*
// Basic query with Drizzle:
import { getDb } from './db';
import { tasks } from '@{app-name}/shared/schema';
import { eq } from 'drizzle-orm';

const allTasks = await getDb().select().from(tasks);
const task = await getDb().select().from(tasks).where(eq(tasks.id, taskId));

// Insert:
const [newTask] = await getDb().insert(tasks).values({
  title: 'My task',
  status: 'pending',
  userId: currentUser.id,
}).returning();

// Transaction:
import { withTransaction } from './db';

const result = await withTransaction(async (tx) => {
  const [task] = await tx.insert(tasks).values({ title, userId }).returning();
  await tx.insert(taskTags).values({ taskId: task.id, tagId });
  return task;
});

// Health check in readiness probe:
import { healthCheck } from './db';

const dbHealth = await healthCheck();
if (!dbHealth.ok) {
  reply.status(503).send({ status: 'not_ready', error: dbHealth.error });
}
*/
