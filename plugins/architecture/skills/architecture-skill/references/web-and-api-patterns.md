# Web and API Patterns

This document defines the standard web and API implementation patterns for **single-tenant Azure applications** built on the Azure Single-Tenant Application Standard.

Its purpose is to ensure that applications using **Next.js App Router** and **Fastify** are structured consistently, with a clear boundary between presentation concerns and application concerns. The standard opinions are: **App Router**, **Server Components by default**, **minimal `use client`**, **service-oriented mutations**, **parallel data fetching**, **avoid waterfalls**, **consistent action response shapes**, and **pragmatic simplicity**.

This document complements:
- `SKILL.md`
- `architecture.md`
- `decision-framework.md`
- `repo-standards.md`
- `data-patterns.md`
- `security.md`
- `observability.md`

---

# Core Implementation Principles

- **Separate presentation from application behavior** — The **web** container handles UI, routing, SSR, and session-aware frontend behavior. The **orchestrator** handles business logic, APIs, data access, AI orchestration, jobs, schedules, and integrations. The web layer should not slowly absorb backend responsibilities.
- **Server-first by default** — All components are Server Components unless there is a real need for browser-only behavior, hooks, event handlers, or a client-only library. This means less browser JavaScript, simpler data fetching, and clearer security boundaries.
- **Keep `use client` low in the tree** — When a Client Component is required, place it as low in the component tree as possible. Do not make an entire page client-side for one interactive widget.
- **Business logic belongs in the orchestrator** — Business rules, data access, validation, external integrations, AI workflows, jobs, schedules, and authorization enforcement all belong in the orchestrator. The web layer should not become a second backend.
- **Simpler is preferred** — Prefer native Next.js/App Router patterns, simple form flows, SSE for streaming, explicit APIs, and minimal client-side state. Avoid extra layers and abstractions unless they clearly improve the solution.

---

# Standard Application Shape

## Web
- `app/` routes, layouts, Server Components, Client Components where needed
- UI composition, auth/session-aware route handling
- Forms, interaction flow, calls to the orchestrator
- Streaming UI for long-running or AI tasks

## Orchestrator
- Fastify routes, request validation, authorization checks
- Services implementing business logic, data access
- Blob Storage integration, AI orchestration, SSE endpoints
- Background job processing, scheduled task handling

## Shared
- Shared types, DTOs, validation schemas, constants, helpers, telemetry helpers
- Do not put application ownership logic into `shared` just because two files might use it

---

# Next.js App Router Patterns

**App Router is the standard frontend architecture.**

**Server Components** — use for page composition, layout composition, initial data loading, route-level UI orchestration, rendering server-fetched data, and auth-aware route handling.

**Client Components** — use only for event handlers, browser APIs, hooks (`useState`, `useEffect`), interactive widgets, and client-only third-party UI libraries.

**Put `use client` low in the tree** — A page should stay server-side if only one part is interactive. Prefer a server page with a small client widget inside it.

**Serialize data carefully** — Do not pass non-serializable values (`Date`, `Map`, `Set`, functions, class instances) from Server Components into Client Components. Convert to serializable primitives or plain objects before crossing the boundary.

---

# Data Fetching Patterns

- **Fetch early** — Fetch data at the highest sensible server boundary. Prefer route-level or page-level data composition in Server Components.
- **Parallelize independent fetches** — Use `Promise.all` for multiple independent reads. Avoid sequential waterfalls.
- **Never fetch in loops** — No N+1 patterns. Prefer relational joins, `include`/`select` patterns, bulk reads, or query refactoring. Aligns with the Postgres-first standard.
- **UI components should not be hidden data loaders** — Keep data loading visible and intentional to avoid accidental waterfalls.

**Server Component parallel fetch:**

```typescript
// app/dashboard/page.tsx — fetch at route level, parallelize independent reads
export default async function DashboardPage() {
  const [orders, stats] = await Promise.all([
    orchestratorClient.get('/api/orders/recent'),
    orchestratorClient.get('/api/dashboard/stats'),
  ]);
  return <Dashboard orders={orders.data} stats={stats.data} />;
}
```

---

# Form and Mutation Patterns

- **Prefer native forms** — Use uncontrolled forms, `FormData`, native HTML validation (`required`, `min`, `max`, `pattern`), simple submit buttons. Do not introduce complex client-side form libraries by default.
- **Server-side validation is required** — All mutations must validate on the server. Prefer validation at the service or API boundary using explicit schemas.
- **Revalidate after mutation** — When a mutation changes rendered data, revalidate the affected path or cache entry.
- **Long-running mutations should become jobs** — Client-invoked mutations should return quickly. If work takes significant time, enqueue a job, return a status envelope, and stream progress or allow later status lookup.

---

# API and Fastify Patterns

**Fastify is the standard backend framework** for the orchestrator service.

**Route handlers should stay thin** — authenticate/authorize, validate input, call a service, map result to HTTP response, emit telemetry. Do not place large business workflows directly in route files.

**Services own business logic** — Organize backend logic into services with responsibilities like: applying business rules, reading/writing PostgreSQL, interacting with Blob Storage, invoking AI providers, enqueueing jobs, handling retries and fallback behavior.

**Validate at boundaries** — Every inbound request should be validated (route params, query params, request body, file metadata, tool input/output) before entering core business logic.

**Fastify route handler with typed response:**

```typescript
fastify.get<{ Params: { id: string } }>(
  '/api/orders/:id',
  { preHandler: requireAuth },
  async (request, reply) => {
    const order = await orderService.getById(request.params.id, request.user);
    if (!order) return reply.code(404).send({ error: 'Order not found' });
    return reply.send({ data: order });
  }
);
```

---

# Web-to-Orchestrator Interaction

- Web handles UI; orchestrator handles business and protected operations. The web layer should not become a second source of business logic.
- Use clear request/response shapes. Shared DTOs or validation schemas can live in `packages/shared` where that genuinely reduces drift.
- **HTTP** for normal request/response, **SSE** for server-to-client streaming. Do not invent more complex communication patterns without a strong reason.

---

# Authentication and Authorization Patterns

**Microsoft Entra ID** is the default identity system. Do not use GitHub-auth or Auth.js patterns as defaults. See `security.md` for full detail.

- **Web layer**: route-aware session checks, redirect flows, auth-aware rendering
- **Orchestrator**: actual authorization enforcement, role-based checks, protected data access, tenant/country/business-unit scoping

The backend remains the trust boundary. The UI can hide or show controls, but the orchestrator must enforce protected operations.

---

# Streaming Patterns

**SSE is the default streaming mechanism** for AI response streaming, progress updates, job progress, long-running task feedback, and one-way server-to-client notifications. SSE is simpler than WebSockets, HTTP-native, and proxy-friendly — enough for most business-app streaming scenarios. See `architecture.md` and `decision-framework.md` for additional context.

**WebSockets are an exception** — use only when the app truly requires bidirectional low-latency messaging, multi-user synchronized state, or collaborative interaction that SSE cannot support. Do not choose WebSockets just because the app has AI chat or progress updates.

---

# File Upload Patterns

- Files live in **Blob Storage**, metadata lives in **PostgreSQL**, access control is enforced in the orchestrator
- Typical flow: web collects file input, orchestrator validates request and access, orchestrator handles upload or issues controlled upload instructions, orchestrator writes metadata, Blob stores content

---

# State Management Patterns

- **Prefer server state** — Use Server Components, backend reads, and simple invalidation/revalidation. Do not add client-state libraries by default.
- **Local client state only when needed** — `useState`, `useReducer`, or Context are fine for local UI interaction, temporary form state, and widget-level interactivity. Avoid Redux-like global state without a genuinely strong reason.
- **Caching** — Use framework-level and application-level caching carefully. **Azure Managed Redis** is the approved distributed cache if needed, but is not part of the baseline. Do not interpret Redis availability as "always add Redis."

---

# Service Organization Patterns

**Keep service folders predictable.** Typical orchestrator structure: `routes/`, `services/`, `middleware/`, `lib/`, `telemetry/`. Typical web structure: `app/`, `components/`, `lib/`, `services/` (web-owned helpers only, not core business logic).

- One clear responsibility per file — do not mix route logic, validation, business logic, and data access in one file
- Avoid unnecessary abstraction — "Rule of Two": only generalize once there is real repeated use

---

# Error Handling Patterns

- **Predictable result shapes** — Use consistent result shapes for mutations and service-layer operations. Prefer a `failed` flag for consistency across generated code.
- **Separate user-facing errors from operational details** — The UI gets safe error messages, validation failures, and retry guidance. Operational details belong in logs and traces.
- **Emit telemetry for failures** — Log structurally, trace with correlation context, classify clearly. Especially important for orchestrator routes, background jobs, schedules, AI/provider calls, and SSE streaming failures.

---

# AI-Specific Web/API Patterns

**Keep AI orchestration in the backend** — prompt construction, retrieval, tool calls, provider invocation, fallback logic, cost/token tracking, and streaming events all belong in the orchestrator.

**Use typed streaming events** rather than ad hoc text streams:
- `text_delta`
- `tool_start`
- `tool_result`
- `progress`
- `message_complete`
- `error`

**AI actions should be observable** — emit request traces, retrieval traces, provider/model info, token usage, and failure/fallback signals. This aligns with the observability standard.

---

# Anti-Patterns to Avoid

**Anti-pattern — business logic in the web layer:**

```typescript
// BAD: web layer runs business rules and database queries directly
// app/api/orders/approve/route.ts
export async function POST(req: Request) {
  const order = await db.orders.findById(req.body.id);  // direct DB access in web
  if (order.total > 10000) await notifyManager(order);   // business rule in web
  await db.orders.update(order.id, { status: 'approved' });
}

// GOOD: web delegates to orchestrator, which owns business logic
export async function POST(req: Request) {
  const result = await orchestratorClient.post('/api/orders/approve', req.body);
  return Response.json(result);
}
```

- Marking entire pages `'use client'` when only a small widget needs it
- Sequential data fetching when parallel fetching is possible
- Fetching in loops
- Passing non-serializable values to Client Components
- Hiding business logic inside React components
- Putting protected business operations in the web layer
- Long-running client-triggered actions without queueing
- Using WebSockets for ordinary streaming use cases
- Inventing a different service structure for every app
- Adding heavyweight state libraries without strong reason
- Carrying forward GitHub/Auth.js defaults when the platform standard is Entra ID

---

# Closing: What Good Looks Like

A developer or support engineer should be able to answer: Which code is presentation logic? Which is business logic? Where does the web call the orchestrator? Where are requests validated? Where is authorization enforced? How are files, AI flows, and streaming handled? Why is this component client-side? Where would I add a new business operation?

**Start with the baseline.** Do not postpone: App Router, Server Components by default, low-in-tree Client Components, Fastify backend, explicit validation, backend-owned business logic, SSE streaming, queueing for long-running work, backend-owned AI orchestration. More specialized patterns (richer client state, advanced caching, WebSocket collaboration, additional backend services) can be added later where justified.

The goal is not to force every app to look identical — it is to make most apps similar enough to be easy to build, support, and evolve.
