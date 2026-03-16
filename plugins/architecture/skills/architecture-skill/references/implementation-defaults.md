# Implementation Defaults

Standard implementation-level defaults for **single-tenant Azure applications** built on the Azure Single-Tenant Application Standard. These defaults eliminate sprint-zero "decision tax" on choices that don't differentiate the product — validation, response format, data access, testing tools, and naming conventions.

Complements: `SKILL.md`, `data-patterns.md`, `web-and-api-patterns.md`, `testing.md`, `architecture.md`

---

# Two-Tier Default System

Defaults are split into **mandatory** and **recommended** tiers.

**Mandatory defaults** are part of the standard. Deviating requires a registered entry in `docs/architecture-deviations.md` using the `DEV-NNN` format from `plugins/architecture/templates/deviation-registry.md`. Teams must document the rationale and impact before proceeding with an alternative.

**Recommended defaults** are strong suggestions that reduce cross-project drift. No formal registration is required to deviate — a comment in the architecture decision document is sufficient.

---

# Mandatory Defaults

## Zod Validation at Every Boundary

All API inputs must be validated at the route boundary before entering business logic. Use **Zod** as the validation library.

**Two validation layers:**
- **Hand-written API schemas** in `packages/shared/src/validation/` — define the shape of API request bodies, query parameters, and path parameters. These are the contract between web and orchestrator.
- **`drizzle-zod` generated schemas** — auto-generated from Drizzle table definitions for DB-layer validation. Use for internal service boundaries, not as API contracts.

**Route-level validation pattern:**

```typescript
const parsed = createTaskSchema.safeParse(request.body);
if (!parsed.success) {
  return reply.code(400).send({
    failed: true,
    error: 'Validation failed',
    details: parsed.error.flatten().fieldErrors,
  });
}
```

Every route handler validates before calling a service. No raw `request.body` reaches business logic.

**What to avoid:** Joi, Yup, class-validator, or manual `if` chains. These are non-standard and require deviation registration.

## API Response Envelope

All orchestrator API responses use a consistent envelope:

| Scenario | Shape | HTTP Status |
|----------|-------|-------------|
| Successful read | `{ data }` | 200 |
| Successful mutation | `{ data, failed: false }` | 200/201 |
| Client error | `{ failed: true, error: "message" }` | 400/401/403/404 |
| Validation error | `{ failed: true, error: "Validation failed", details: { field: "reason" } }` | 400 |
| Server error | `{ failed: true, error: "Internal server error" }` | 500 |

**500 errors never leak internals.** Log the full error server-side; return a generic message to the client.

Use the response envelope helper (`apps/orchestrator/src/lib/response.ts`) to enforce consistency. See the `example-route.ts` and `example-service.ts` asset templates for the complete connected pattern.

## Blob Storage: Orchestrator-Proxied by Default

Browser clients access blob storage through the orchestrator API, never directly.

**Flow:** browser → orchestrator API → Azure Blob Storage

This pattern:
- Eliminates CORS complexity on storage accounts
- Enforces server-side authentication and authorization
- Keeps blob credentials out of frontend code
- Enables server-side validation of uploads (size, type, ownership)

**Deviation option:** SAS tokens with short TTL are approved for high-volume download scenarios (video streaming, bulk exports) where proxying creates a bandwidth bottleneck. Requires `DEV-NNN` registration. SAS tokens must be short-lived (< 15 minutes) and scoped to specific containers/blobs.

---

# Recommended Defaults

## TanStack Query (React Query)

For React frontends, use **TanStack Query** for server state management:
- Provider component in `apps/web/components/providers.tsx`
- Query hooks in `apps/web/lib/queries.ts`
- Scoped query keys: `['tasks']`, `['tasks', id]`
- Optimistic updates for mutations
- Cache invalidation aligned with mutation success
- Unwrap the `{ data }` envelope in query functions

Deviate for non-React frameworks or when the web layer uses only Server Components with no client-side data fetching.

## Tailwind CSS

Use **Tailwind CSS** for utility-first styling with mobile-first responsive design. Deviate if the team has a strong CSS-in-JS preference or the project inherits an existing design system with a different approach.

---

# Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Database tables | plural snake_case | `tasks`, `task_tags` |
| Database columns | snake_case | `created_at`, `user_id` |
| Primary keys | `id` (bigint generated always as identity) | `id bigint GENERATED ALWAYS AS IDENTITY` |
| Foreign keys | `{table_singular}_id` | `task_id`, `user_id` |
| Indexes | `idx_{table}_{columns}` | `idx_tasks_status`, `idx_task_tags_task_id` |
| API endpoints | kebab-case nouns, plural | `/api/tasks`, `/api/task-tags` |
| JSON fields | camelCase | `createdAt`, `userId` |
| TS variables/functions | camelCase | `getTaskById`, `taskCount` |
| TS types/interfaces | PascalCase | `Task`, `CreateTaskBody` |
| React components | PascalCase | `TaskList`, `TaskDetail` |
| File names | kebab-case | `task-service.ts`, `create-task.tsx` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_UPLOAD_SIZE`, `DEFAULT_PAGE_SIZE` |
| Package scope | `@{app-name}/` | `@myapp/shared`, `@myapp/web` |

UUIDs remain an approved exception for primary keys per `data-patterns.md` — bigint identity is the default, not the only option.

---

# Testing Defaults

See `testing.md` for the full testing standard. The mandatory defaults are **Vitest** (unit/integration) and **Playwright** (E2E). Jest, Mocha, and Cypress are non-standard and require deviation registration.

---

# Baseline Checklist and Litmus Test

A project following implementation defaults should have:
- [ ] Zod validation on every API route boundary
- [ ] `drizzle-zod` for DB-layer schema generation
- [ ] Response envelope used consistently across all routes
- [ ] Blob access proxied through orchestrator
- [ ] Naming conventions followed per the table above
- [ ] Vitest for unit/integration tests, Playwright for E2E
- [ ] Drizzle ORM as the data access layer (see `data-patterns.md`)
- [ ] Thin route handlers delegating to services (see `web-and-api-patterns.md`)

**Litmus test:** Can a new developer join the project and predict the validation library, response format, test runner, file naming pattern, and data access approach without reading project-specific documentation?

## What to Avoid

- Mixing validation libraries (Zod in some routes, Joi in others)
- Inconsistent response shapes (some routes return `{ data }`, others return raw objects)
- Frontend code holding blob storage credentials or SAS tokens
- Business logic in route handlers instead of services
- Unvalidated request bodies reaching service methods
- ad hoc naming that ignores the conventions table
