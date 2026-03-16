/**
 * Example Route Handler Template
 *
 * This is a reference template demonstrating the complete mandatory pattern:
 * auth → validate (Zod) → service.method() → response envelope
 *
 * Copy to apps/orchestrator/src/routes/ and adapt to your domain entities.
 * Pair with example-service.ts for the complete thin-route → service pattern.
 *
 * See web-and-api-patterns.md for the route handler formula.
 * See implementation-defaults.md for Zod validation and response envelope specs.
 */

import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth-middleware';
import { createTaskSchema, updateTaskSchema, taskQuerySchema } from '@{app-name}/shared/validation/tasks';
import * as taskService from '../services/task-service';
import {
  sendSuccess,
  sendMutationSuccess,
  sendError,
  sendValidationError,
} from '../lib/response';

export async function taskRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /api/tasks — List tasks (read → { data })
  // -------------------------------------------------------------------------
  fastify.get(
    '/api/tasks',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = taskQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten().fieldErrors);
      }

      const tasks = await taskService.list(parsed.data, request.user);
      return sendSuccess(reply, tasks);
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/tasks/:id — Get task by ID (read → { data } or 404)
  // -------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/api/tasks/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const task = await taskService.getById(
        Number(request.params.id),
        request.user,
      );

      if (!task) {
        return sendError(reply, 'Task not found', 404);
      }

      return sendSuccess(reply, task);
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/tasks — Create task (mutation → { data, failed: false })
  // -------------------------------------------------------------------------
  fastify.post(
    '/api/tasks',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = createTaskSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten().fieldErrors);
      }

      const task = await taskService.create(parsed.data, request.user);
      return sendMutationSuccess(reply, task, 201);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /api/tasks/:id — Update task (mutation → { data, failed: false })
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: { id: string } }>(
    '/api/tasks/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = updateTaskSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten().fieldErrors);
      }

      const task = await taskService.update(
        Number(request.params.id),
        parsed.data,
        request.user,
      );

      if (!task) {
        return sendError(reply, 'Task not found', 404);
      }

      return sendMutationSuccess(reply, task);
    },
  );
}
