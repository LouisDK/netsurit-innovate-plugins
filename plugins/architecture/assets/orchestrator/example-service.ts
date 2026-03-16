/**
 * Example Domain Service Template
 *
 * This is a reference template demonstrating the service layer pattern.
 * Business logic lives here — not in route handlers.
 *
 * Copy to apps/orchestrator/src/services/ and adapt to your domain entities.
 * Pair with example-route.ts for the complete thin-route → service pattern.
 *
 * Key principles:
 * - Receives typed inputs + authenticated user context (never raw request/reply)
 * - Owns data access via Drizzle ORM
 * - Returns domain objects (not HTTP responses)
 * - One service per domain entity
 *
 * See web-and-api-patterns.md for the service organization pattern.
 * See data-patterns.md for Drizzle ORM conventions.
 */

import { getDb } from '../lib/db';
import { tasks } from '@{app-name}/shared/schema/tasks';
import { eq, desc } from 'drizzle-orm';
import type { CreateTaskBody, UpdateTaskBody, TaskQuery } from '@{app-name}/shared/validation/tasks';

interface AuthenticatedUser {
  id: number;
  roles: string[];
}

/**
 * Create a new task.
 */
export async function create(
  input: CreateTaskBody,
  user: AuthenticatedUser,
) {
  const db = getDb();

  const [task] = await db
    .insert(tasks)
    .values({
      title: input.title,
      status: 'pending',
      userId: user.id,
    })
    .returning();

  return task;
}

/**
 * Get a task by ID. Returns null if not found or not accessible.
 */
export async function getById(
  id: number,
  user: AuthenticatedUser,
) {
  const db = getDb();

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id));

  if (!task || task.userId !== user.id) {
    return null;
  }

  return task;
}

/**
 * List tasks for the authenticated user with pagination.
 */
export async function list(
  query: TaskQuery,
  user: AuthenticatedUser,
) {
  const db = getDb();
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;

  const results = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .orderBy(desc(tasks.createdAt))
    .limit(limit)
    .offset(offset);

  return results;
}

/**
 * Update a task. Returns null if not found or not accessible.
 */
export async function update(
  id: number,
  input: UpdateTaskBody,
  user: AuthenticatedUser,
) {
  const db = getDb();

  // Verify ownership first
  const existing = await getById(id, user);
  if (!existing) return null;

  const [updated] = await db
    .update(tasks)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning();

  return updated;
}
