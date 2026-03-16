/**
 * TanStack Query Example Hooks Template
 *
 * This is a reference template. Copy to apps/web/lib/queries.ts
 * and adapt to your domain entities and API endpoints.
 *
 * Demonstrates:
 * - Scoped query keys for cache management
 * - List and single-item queries
 * - Mutation with cache invalidation
 * - Unwrapping the { data } response envelope
 *
 * See implementation-defaults.md for the TanStack Query recommendation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@{app-name}/shared/schema/tasks';
import type { CreateTaskBody } from '@{app-name}/shared/validation/tasks';

const API_BASE = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? 'http://localhost:3001';

// ============================================================================
// Query Keys — scoped for fine-grained cache control
// ============================================================================

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: number) => [...taskKeys.details(), id] as const,
};

// ============================================================================
// Fetch helpers — unwrap the { data } envelope
// ============================================================================

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
  });

  const json = await res.json();

  if (!res.ok || json.failed) {
    throw new Error(json.error ?? 'Request failed');
  }

  return json.data as T;
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch a list of tasks.
 */
export function useTasks(filters: Record<string, unknown> = {}) {
  const params = new URLSearchParams(
    Object.entries(filters).map(([k, v]) => [k, String(v)]),
  );

  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => fetchApi<Task[]>(`/api/tasks?${params}`),
  });
}

/**
 * Fetch a single task by ID.
 */
export function useTask(id: number) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => fetchApi<Task>(`/api/tasks/${id}`),
    enabled: !!id,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new task with cache invalidation.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTaskBody) =>
      fetchApi<Task>('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      // Invalidate all task list queries to refetch with the new item
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}
