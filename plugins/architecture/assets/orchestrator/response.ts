/**
 * API Response Envelope Helpers Template
 *
 * This is a reference template. Copy to apps/orchestrator/src/lib/response.ts
 * and adapt to your application's needs.
 *
 * Enforces the standard response envelope:
 * - Reads:      { data }
 * - Mutations:  { data, failed: false }
 * - Errors:     { failed: true, error }
 * - Validation: { failed: true, error: "Validation failed", details }
 *
 * See implementation-defaults.md for the full envelope specification.
 */

// ============================================================================
// Types
// ============================================================================

export interface SuccessResponse<T> {
  data: T;
}

export interface MutationSuccessResponse<T> {
  data: T;
  failed: false;
}

export interface ErrorResponse {
  failed: true;
  error: string;
}

export interface ValidationErrorResponse {
  failed: true;
  error: 'Validation failed';
  details: Record<string, string[]>;
}

export type ApiResponse<T> =
  | SuccessResponse<T>
  | MutationSuccessResponse<T>
  | ErrorResponse
  | ValidationErrorResponse;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Wrap a successful read response.
 */
export function success<T>(data: T): SuccessResponse<T> {
  return { data };
}

/**
 * Wrap a successful mutation response.
 */
export function successMutation<T>(data: T): MutationSuccessResponse<T> {
  return { data, failed: false };
}

/**
 * Wrap an error response. Never leak internal details in the message.
 */
export function error(message: string): ErrorResponse {
  return { failed: true, error: message };
}

/**
 * Wrap a validation error response with per-field details.
 */
export function validationError(
  details: Record<string, string[]>,
): ValidationErrorResponse {
  return { failed: true, error: 'Validation failed', details };
}

// ============================================================================
// Fastify Reply Helpers
// ============================================================================

import type { FastifyReply } from 'fastify';

/**
 * Send a success read response (200).
 */
export function sendSuccess<T>(reply: FastifyReply, data: T): void {
  reply.code(200).send(success(data));
}

/**
 * Send a success mutation response (200 or 201).
 */
export function sendMutationSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode: 200 | 201 = 200,
): void {
  reply.code(statusCode).send(successMutation(data));
}

/**
 * Send an error response with the given status code.
 */
export function sendError(
  reply: FastifyReply,
  message: string,
  statusCode: number = 400,
): void {
  reply.code(statusCode).send(error(message));
}

/**
 * Send a validation error response (400).
 */
export function sendValidationError(
  reply: FastifyReply,
  details: Record<string, string[]>,
): void {
  reply.code(400).send(validationError(details));
}

// ============================================================================
// Usage Examples
// ============================================================================
/*
import { sendSuccess, sendMutationSuccess, sendError, sendValidationError } from '../lib/response';

// GET read:
const task = await taskService.getById(id, request.user);
if (!task) return sendError(reply, 'Task not found', 404);
return sendSuccess(reply, task);

// POST mutation:
const newTask = await taskService.create(parsed.data, request.user);
return sendMutationSuccess(reply, newTask, 201);

// Validation error:
const parsed = createTaskSchema.safeParse(request.body);
if (!parsed.success) {
  return sendValidationError(reply, parsed.error.flatten().fieldErrors);
}
*/
