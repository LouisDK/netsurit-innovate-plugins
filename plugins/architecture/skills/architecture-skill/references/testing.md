# Testing

This document defines the standard testing approach for **single-tenant Azure applications** built on the Azure Single-Tenant Application Standard: Next.js web, Fastify orchestrator, PostgreSQL-first data model, Blob Storage file handling, PostgreSQL-backed jobs and schedules, Azure Container Apps deployment, OpenTelemetry-aware operations, and AI-enabled workflows where applicable.

The goal is not to maximize test count or chase abstract coverage metrics. The goal is to create **confidence** that the application works, is supportable, and can be changed safely.

Complements: `SKILL.md`, `architecture.md`, `decision-framework.md`, `repo-standards.md`, `data-patterns.md`, `deployment.md`, `observability.md`, `security.md`, `web-and-api-patterns.md`

---

# Testing Principles

- **Test behavior that matters** — business rules, validation, authorization, data persistence, job/schedule processing, AI workflows, deployment smoke paths. Do not write tests just because a file exists.
- **Align tests to architecture boundaries** — web, orchestrator, shared logic, PostgreSQL, Blob workflows, jobs, schedules, deployment health/readiness. Follow these natural boundaries rather than inventing a different model.
- **Prefer the simplest test that gives confidence** — unit tests for pure/local logic, integration tests when boundaries matter, smoke tests for end-to-end confidence, UI/component tests only when they genuinely add value. Do not default to the heaviest level.
- **Confidence over vanity coverage** — weak assertions, brittle snapshots, shallow trivial tests, and missing integration coverage can still show high coverage while providing poor confidence.
- **Keep tests maintainable** — readable, focused on meaningful behavior, fail clearly, fast enough to run regularly, mapped to real architecture and product risk.

---

# Standard Test Runner: Vitest

Use **Vitest** as the default test runner for all packages and applications in the monorepo. It is fast with native ESM and TypeScript support, compatible with the Node.js stack across web and orchestrator, lightweight to configure in a pnpm monorepo, and has a Jest-compatible API.

Use `vitest` for unit and integration tests. For end-to-end browser tests, Playwright remains the standard choice.

---

# Standard Test Layers

## 1. Unit tests

For pure business logic, validation helpers, deterministic domain rules, and non-I/O logic. Good candidates: status transitions, scheduling calculations, retry logic, DTO mapping, permission helpers.

```typescript
// Vitest example: testing schedule next-run calculation
import { describe, it, expect } from 'vitest';
import { computeNextRun } from './schedule-utils';

describe('computeNextRun', () => {
  it('advances to next interval from last run', () => {
    const last = new Date('2026-03-01T08:00:00Z');
    expect(computeNextRun(last, '30m')).toEqual(new Date('2026-03-01T08:30:00Z'));
  });
});
```

## 2. Integration tests

For boundaries where correctness depends on database behavior, HTTP request/response, validation at service entry, authorization enforcement, file metadata persistence, job/schedule claiming, Blob workflows, or AI orchestration with mocked providers.

For this architecture, integration tests are often the most valuable layer.

## 3. Smoke tests

For deployed health/readiness verification, critical route reachability, minimal app startup confidence, basic environment wiring, and post-deploy validation. Should stay small and fast.

## 4. UI/component tests

Only where they add real confidence: interactive Client Components with meaningful logic, non-trivial state behavior, rendering branches hard to cover through larger flows, streaming UI behavior. Do not over-invest in shallow tests for simple presentational components.

## 5. End-to-end tests

Use sparingly: a few critical user journeys, login/access happy path, one or two high-value workflows, high-risk production scenarios. Do not try to cover the whole app this way.

---

# Testing the Web Application

Test `apps/web` for: route-level rendering behavior, auth-aware routing, form submission, Client Component interactivity, streaming UI behavior, and error/empty-state rendering where significant.

Avoid heavy effort on: trivial presentational or markup-only components, simple wrappers, every branch of framework-managed behavior. Test your application behavior, not the framework.

**Server Components** — much of the web app's value is in route composition, server-side data loading, authorization-aware rendering, and orchestrator API interaction. Test important behavior around those boundaries, not just the component tree.

**Client Components** — test when they have real logic: local state transitions, complex form interactions, custom input handling, streaming state updates, error recovery. Do not add tests just because a component has `'use client'`.

---

# Testing the Orchestrator

The orchestrator holds business logic, APIs, validation, authorization, PostgreSQL access, Blob coordination, AI orchestration, jobs, and schedules. This layer deserves the strongest testing focus.

- **Route-level tests** — request validation, auth/authorization failures, expected success responses, error mapping, route contracts, SSE endpoint behavior. Routes should remain thin but are important boundaries.
- **Service-level tests** — business rules, domain transitions, transaction behavior, retry/fallback logic, AI orchestration decisions, file workflow coordination, job enqueue behavior, schedule handling. Often the most important test target.
- **Validation tests** — every significant input boundary: request body, params, query string, file metadata, AI tool inputs, schedule configuration, job payload shape. Validation is both a correctness and a security concern.

---

# Database Testing

Because PostgreSQL is central, database integration testing is important. Test: persistence of core entities, transaction behavior, status transitions, job/schedule claiming, migration compatibility, metadata persistence for file workflows, retrieval metadata if using pgvector.

Use tests that exercise real schema and real query logic. Avoid relying entirely on mocked repositories for logic that is database-sensitive.

At minimum verify that migrations apply cleanly, a clean database reaches the latest schema, and critical migration paths do not break app startup or core flows.

---

# Blob and File Workflow Testing

Because Blob Storage holds file content and PostgreSQL holds metadata, test the workflow around both: create metadata correctly, associate files to owning entities, reject unauthorized upload/download, handle missing/replaced files, preserve file lifecycle state.

Blob operations can often be mocked while still testing ownership logic, metadata persistence, orchestrator behavior, and authorization. But do not skip testing application behavior around files entirely.

---

# Jobs Testing

Background jobs are first-class application behavior. Important scenarios:
- enqueue, claim safely, mark processing, mark completed
- handle failure, increment retry count, reschedule delayed retry
- move poison jobs to failed/dead-letter state
- preserve correlation context where relevant

**Idempotency** — if a job can be retried, test that retry behavior does not produce unsafe duplicate side effects. Especially important for external API calls, notifications, document generation, AI workflows with persistence, and state transitions.

**Concurrency** — where job claiming uses PostgreSQL row locking, verify that a claimed job is not immediately re-claimed, retries behave correctly, and due jobs are selected correctly.

---

# Scheduled Task Testing

Schedules are durable application state, not just timers. Test: identifying due schedules, claiming safely, creating the correct background job, computing next run correctly, handling disabled schedules, failure tracking, and concurrency policy where implemented.

Keep scheduler logic separate from job execution logic in tests. The scheduler enqueues work; the job executes it. Do not conflate them into one vague "cron test."

---

# AI and LLM Testing

AI-enabled applications should be tested for orchestration behavior, retrieval decisions, tool invocation paths, fallback behavior, failure handling, and streaming event structure. Do not assume AI behavior is "too dynamic to test" — the deterministic parts around it are highly testable.

- **Mock** external model/embedding providers, tool side effects, third-party network responses to keep tests stable.
- **Test** prompt input shaping, retrieval/no-retrieval branching, tool selection logic, tool input validation, retry/fallback paths, result/event envelope shape, token/cost recording where implemented.
- **Streaming** — verify stream starts correctly, expected event shape is emitted, completion and error events are emitted, interrupted/failure conditions are handled. The goal is to verify the streaming contract, not assert every token chunk literally.

---

# Authorization and Security Testing

Do not assume auth/authorization works because middleware exists. Test: unauthenticated request rejected, authenticated but unauthorized request rejected, authorized request succeeds, data scoping enforced, protected file operations enforced, admin/higher-privilege routes properly restricted.

Security-sensitive boundaries that deserve tests: file access rules, schedule/admin mutation routes, job replay/admin operations, AI/tool operations triggering side effects, secret-dependent runtime assumptions where testable. These are high-value tests because failures are costly.

---

# Observability Testing

Verify important observable behaviors: health and readiness endpoints return expected shapes, job/schedule execution emits expected state changes, AI streaming paths return expected event envelopes. Health and readiness are part of the app contract — test them like other important routes.

---

# Deployment and Smoke Testing

Every production-oriented app needs a small smoke-test layer: web `/api/health`, web homepage or basic route, orchestrator `/api/health`, orchestrator `/api/ready`, one lightweight business endpoint if appropriate, version/build visibility where implemented.

These are not full regression tests. They answer: Did the app come up? Is it wired correctly? Can main services answer requests?

---

# Test Data and Fixtures

Use fixtures that resemble the actual domain, not toy placeholders. Keep setup readable with small builders and factory helpers rather than giant JSON blobs.

---

# Mocking Guidance

- Mock external providers, network systems, and time where useful
- Avoid mocking core business logic or persistence when those boundaries need confidence
- Integration testing orchestrator + database is usually better than fully mocking the data layer
- Mocks help with network flakiness and hard-to-reach failures — less useful when they erase important boundaries

---

# Anti-Patterns, Distribution, and Closing Guidance

**Anti-pattern — testing implementation details vs behavior:**

```typescript
// BAD: asserts internal calls, breaks on any refactor
expect(service.processOrder).toHaveBeenCalledWith(mockDb, mockCache, 'order-1');

// GOOD: asserts observable outcome
const result = await service.processOrder('order-1');
expect(result.status).toBe('confirmed');
expect(await db.orders.findById('order-1')).toMatchObject({ status: 'confirmed' });
```

**Avoid by default:** testing trivial components heavily, relying only on unit tests for data-heavy apps, skipping integration tests for jobs and schedules, brittle snapshot sprawl, huge end-to-end suites, asserting implementation details instead of behavior, over-mocking internal logic, coverage targets that reward shallow tests, leaving deployment verification manual, treating AI flows as "untestable."

**Healthy test distribution:** many focused unit tests for deterministic logic, solid integration tests around orchestrator/data/jobs/schedules, fewer web/client tests, very few end-to-end tests, and a required smoke-test layer.

**Baseline checklist** — a production app should include: unit tests for important pure logic, integration tests for orchestrator routes/services, integration tests for PostgreSQL-backed behavior, tests for jobs and schedules behavior, tests for authorization-sensitive routes, tests for file metadata/workflow logic, SSE/stream contract tests where streaming is used, smoke tests for deployed health/readiness, migration verification for deployment confidence.

**What good looks like** — the team can answer: Which business rules and orchestrator routes are tested? Are jobs, schedules, and authorization boundaries covered? Are health/readiness routes verified? Are AI flows tested at the orchestration level? Can we deploy with confidence the app starts and responds correctly?

**Evolution** — start with the baseline first. Service/business-logic tests, data integration tests, jobs/schedules tests, authorization tests, smoke tests, and health/readiness verification are not optional later improvements. More advanced investments (end-to-end coverage, performance testing, contract testing, AI evaluation suites, load testing, deployment validation gates) come later where justified.
