/**
 * PostgreSQL Connection Pool Template
 *
 * This is a reference template. Copy to apps/orchestrator/src/pool.ts
 * and adapt to your application's database needs.
 *
 * Features:
 * - Lazy singleton pool initialization
 * - Generic query wrapper with type parameter
 * - Transaction helper with proper BEGIN/COMMIT/ROLLBACK
 * - Health check returning { ok, latencyMs, error? }
 * - Graceful pool closure for shutdown
 * - Pool error event listener
 *
 * Note: Database access belongs in the orchestrator, not in shared/.
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { getConfig } from './config';

let pool: Pool | null = null;

export function initPool(): Pool {
  if (pool) return pool;

  const config = getConfig();
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on('error', (err) => {
    console.error('[pool] Unexpected pool error:', err.message);
  });

  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    return initPool();
  }
  return pool;
}

/**
 * Execute a parameterized query.
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/**
 * Execute a function within a database transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
    await getPool().query('SELECT 1');
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
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ============================================================================
// Usage Examples
// ============================================================================
/*
// Basic query:
import { query } from './pool';

const result = await query<{ id: string; name: string }>(
  'SELECT id, name FROM users WHERE email = $1',
  [email]
);
const user = result.rows[0];

// Transaction with FOR UPDATE SKIP LOCKED (job claiming pattern):
import { withTransaction } from './pool';

const job = await withTransaction(async (client) => {
  const { rows } = await client.query(
    `UPDATE jobs
     SET status = 'processing', locked_by = $1, locked_at = NOW()
     WHERE id = (
       SELECT id FROM jobs
       WHERE status = 'pending' AND available_at <= NOW()
       ORDER BY priority DESC, created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`,
    [workerId]
  );
  return rows[0] || null;
});

// Health check in readiness probe:
import { healthCheck } from './pool';

const dbHealth = await healthCheck();
if (!dbHealth.ok) {
  reply.status(503).send({ status: 'not_ready', error: dbHealth.error });
}
*/
