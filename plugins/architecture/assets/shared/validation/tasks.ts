/**
 * Example Hand-Written Zod API Validation Schemas Template
 *
 * This is a reference template. Copy to packages/shared/src/validation/
 * and adapt schemas to your domain entities.
 *
 * These are hand-written API-shape schemas — they define the contract
 * between web and orchestrator. They are distinct from drizzle-zod schemas
 * (auto-generated from table definitions) which are used for DB-layer validation.
 *
 * - API schemas: hand-written, define what the client sends
 * - DB schemas: auto-generated via drizzle-zod, define what the database stores
 *
 * See implementation-defaults.md for the full validation standard.
 */

import { z } from 'zod';

// ============================================================================
// Create Task — POST /api/tasks request body
// ============================================================================

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or fewer'),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional(),
  tagIds: z
    .array(z.number().int().positive())
    .max(10, 'Maximum 10 tags per task')
    .optional(),
});

export type CreateTaskBody = z.infer<typeof createTaskSchema>;

// ============================================================================
// Update Task — PATCH /api/tasks/:id request body
// ============================================================================

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: z
    .enum(['pending', 'in_progress', 'completed', 'cancelled'])
    .optional(),
});

export type UpdateTaskBody = z.infer<typeof updateTaskSchema>;

// ============================================================================
// Task Query — GET /api/tasks query parameters
// ============================================================================

export const taskQuerySchema = z.object({
  status: z
    .enum(['pending', 'in_progress', 'completed', 'cancelled'])
    .optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0),
});

export type TaskQuery = z.infer<typeof taskQuerySchema>;
