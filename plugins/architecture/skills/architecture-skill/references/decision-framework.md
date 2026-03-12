# Decision Framework

This document explains how to make architectural decisions within the Azure Single-Tenant Application Standard.

Complements: `SKILL.md`, `architecture.md`, `web-and-api-patterns.md`, `data-patterns.md`, `security.md`, `observability.md`, `deployment.md`, `repo-standards.md`

The purpose is to help teams choose the **right default** quickly and consistently. Start from the golden path first. Only deviate when the standard path does not meet a clear requirement.

## Decision Order

Evaluate major choices in this order:

1. **Functionality** — Will it meet required business and technical needs?
2. **Maintenance and supportability** — Can the team build, operate, troubleshoot, and evolve it?
3. **Security** — Does it fit our identity, secret handling, ingress, and operational security standards?
4. **Simplicity** — Is this the smallest solution that still works?
5. **Cost** — Is it cost-appropriate for expected scale and criticality?

When two options both work, choose the easier to support. When equally simple, choose cheaper.

---

# 1. Compute Decisions

## Default: Azure Container Apps

Use Container Apps for application services. It balances flexibility, supportability, and simplicity — a good fit for the standard two-container pattern (Next.js web + Fastify orchestrator).

## Exception: Azure Functions

Use Functions only for naturally event-driven or task-oriented workloads (queue/timer/event triggers, narrow scope, bursty execution). Do not default to Functions for general backends.

## Exception: Azure App Service

Use App Service only when full containerization adds overhead without benefit (simple web app/API, no multi-container needs). Do not choose it just because it is familiar.

## Summary

- **Container Apps by default**
- **Functions** for event-driven side workloads
- **App Service** for simpler conventional apps
- Avoid multiple services/containers without a clear domain, scaling, or operational reason

---

# 2. Frontend and API Shape

## Default: Next.js App Router + Fastify

Use Next.js App Router for the web frontend, Fastify for backend orchestration and business logic. This is the preferred standard for most business applications — stable and supportable without unnecessary complexity.

For details on implementation patterns, see `web-and-api-patterns.md`.

## When to keep it simpler

For very small internal tools, keeping more logic in the web layer may be acceptable if a separate orchestrator adds no value. Even then, stay aligned with standard identity, data, observability, and deployment patterns.

Do not add a separate backend by reflex — add it when it improves structure or supportability.

## Realtime guidance

- **Default: Server-Sent Events (SSE)** — for AI streaming, progress updates, one-way server-to-client notifications
- **Exception: WebSockets** — only when truly bidirectional low-latency messaging is needed or multiple clients must synchronize state in real time. Do not use WebSockets for ordinary AI chat streaming.

---

# 3. Data Decisions

For detailed schemas and implementation patterns, see `data-patterns.md`.

## Default: PostgreSQL Flexible Server

Use Azure Database for PostgreSQL Flexible Server for structured application data (transactional, relational, config, audit, business objects, user state). It is flexible, mature, and appropriate for the majority of business applications.

## pgvector: only when needed

Add pgvector only for semantic retrieval, embeddings, similarity search, or RAG-style lookup. Do not include it by default just because the application uses AI.

## Files: Blob Storage

Use Azure Blob Storage for uploaded files, exports, documents, images, and large binaries. Do not store large files in PostgreSQL unless specifically justified.

## Avoid unnecessary extra data stores

Do not introduce another database unless PostgreSQL and Blob Storage cannot reasonably satisfy the requirement.

- **Weak reasons:** "might need it later," "used it before," "it is popular," "feels cloud-native"
- **Strong reasons:** incompatible data access pattern, scale PostgreSQL cannot handle, required capability that would otherwise be brittle

## Summary

- **PostgreSQL first** / **pgvector** only when justified / **Blob Storage** for files / avoid extra databases

---

# 4. Caching and State Acceleration

## Default: no cache at first

Do not add Redis to the baseline architecture. Caching adds invalidation complexity — it should solve a real issue, not a hypothetical one.

## Exception: Azure Managed Redis

Add Redis only when:
- repeated reads materially affect latency or database load
- expensive computed responses should be reused
- coordination between instances needs shared transient state
- rate limiting or short-lived state must be shared across instances

Before adding Redis, verify the issue cannot be solved with better queries, indexes, pagination, batching, or in-process caching.

---

# 5. Queueing and Background Work

## Default: PostgreSQL-backed jobs table

Use a PostgreSQL-backed jobs table for background work. It keeps processing inside the standard platform and avoids queue sprawl.

For the standard schema, worker behavior, and rationale, see `data-patterns.md` — Jobs Table Pattern.

- **`LISTEN / NOTIFY`** may reduce polling latency as an optional accelerator — not the primary mechanism
- **Redis** is not the default queue. It may be justified for rate limiting, distributed locks, or response caching
- **Azure-native messaging** is an approved exception for high-throughput event processing, fan-out, or true broker needs

Do not introduce RabbitMQ or other custom brokers by default.

## Summary

- **PostgreSQL-backed jobs by default** with `FOR UPDATE SKIP LOCKED`
- Retries, delayed execution, and dead-letter handling in the jobs model
- Azure-native messaging only as a justified exception

---

# 6. Scheduled Tasks

## Default: PostgreSQL-backed schedule registry

Use a PostgreSQL-backed schedule registry for recurring work (reporting, nightly syncs, reminders, cleanup, periodic AI batch processing, reconciliation).

For schema and implementation details, see `data-patterns.md` — Schedule Table Pattern.

## What to avoid

Do not use as the primary scheduler: OS cron in containers, ad hoc `setInterval()`, GitHub Actions for runtime scheduling, custom scheduler platforms, or RabbitMQ-based delayed jobs.

## Exception: Azure Functions Timer Trigger

Use Timer Triggers only for tasks clearly better operated outside the main runtime (isolated, infrastructure-adjacent, lightweight).

## Summary

- **PostgreSQL-backed scheduling by default**, enqueue as normal background jobs
- **Functions Timer Trigger** only for isolated timer-driven tasks
- Avoid cron-in-container and ad hoc timers as the main pattern

---

# 7. Identity and Access Decisions

For detailed security standards, see `security.md`.

## Default: Microsoft Entra ID

Use Entra ID for authentication and authorization. Use app roles or group-based authorization. Keep authorization rules explicit and understandable.

## Secrets: Key Vault

Use Azure Key Vault for production secrets, connection strings, certificates, and keys. Do not store secrets in source code, config files, deployment scripts, or ad hoc environment files.

## Managed identities preferred

Use managed identities over static credentials for Azure service-to-service authentication wherever practical.

## Summary

- **Entra ID** / **Key Vault** / **managed identities** / explicit role-based authorization

---

# 8. Observability Decisions

For detailed patterns, see `observability.md`.

## Default: OpenTelemetry + Azure Monitor

Instrument with OpenTelemetry; export to Azure Monitor via Application Insights and Log Analytics.

Every application should include: structured logs, request correlation, traces across services, health/readiness checks, and basic metrics (throughput, latency, failure rate). Applications are not production-ready without usable operational signals.

## AI observability

For AI-enabled apps, include telemetry for: model/provider, latency, token usage, retries, tool invocations, retrieval steps, failures/fallbacks. Do not capture sensitive prompt/response content without an approved reason.

## Escalation

Start with traces, structured logs, core metrics, and health endpoints. Add dashboards, alerts, and workload-specific telemetry as the app matures.

---

# 9. Ingress, Edge, and WAF Decisions

## Default: Application Gateway WAF

Use Azure Application Gateway WAF for regional ingress in production apps needing a WAF. Choose it for conventional, single-region applications.

## Exception: Azure Front Door

Use Front Door only when the app needs global edge presence, multi-region routing, or CDN-like behavior. Do not default to Front Door for ordinary single-region business apps.

## Summary

- **Application Gateway WAF** for the normal production path
- **Front Door** only when global edge capabilities are truly needed

---

# 10. AI and Orchestration Decisions

## Default: backend-hosted AI orchestration

Keep model invocation, tool orchestration, retrieval, and business rule enforcement in the backend/orchestrator service — not the browser layer. This centralizes sensitive integration logic for easier security and support.

## Retrieval

Add retrieval only when the app needs grounded answers over documents too large or dynamic for direct prompt inclusion. Do not add retrieval pipelines by default.

## Prompt and tool design

- **Prefer:** narrow tools, clear schemas, explicit validation, auditable orchestration, deterministic fallbacks
- **Avoid:** large uncontrolled tool surfaces, prompt logic in UI components, hidden side effects, weak input validation

---

# 11. Repository and Delivery Decisions

For detailed standards, see `repo-standards.md`.

## Default: per-project pnpm monorepo

One monorepo per application. Preferred layout: `apps/web`, `apps/orchestrator`, `packages/shared`, `infra`, `schema`, `.github/workflows`. Do not create many small packages unless the boundary is worth preserving.

## CI/CD: GitHub Actions

Each repo should include: lint/type checks, tests, build validation, container build/tag strategy, deployment automation, migration handling, and post-deploy health validation.

Prefer a simple deployment flow a small team can understand. Do not over-engineer release systems for small/medium business apps.

---

# 12. When to Deviate

Deviations are allowed but should be explicit.

A deviation is justified when:
- the standard path cannot meet a required capability
- the operational model is materially better with another approved option
- security requirements require a different design
- cost or simplicity strongly favor an exception without weakening supportability

When deviating, record the decision. A lightweight ADR works well:

```markdown
## ADR: [Short title]
**Status:** Accepted | Superseded
**Context:** What requirement or constraint prompted this?
**Standard path:** What does the default architecture recommend?
**Decision:** What are we doing instead, and why?
**Consequences:** What trade-offs does this introduce?
```

Do not let one deviation become an excuse for broad architectural drift.

---

# Quick Decision Cheatsheet

## Use this by default
- Azure
- Container Apps
- Next.js + Fastify
- pnpm monorepo
- PostgreSQL
- Blob Storage
- Entra ID
- Key Vault
- OpenTelemetry
- Application Insights / Log Analytics
- SSE
- PostgreSQL-backed jobs
- PostgreSQL-backed schedules

## Add only when justified
- pgvector
- Azure Managed Redis
- Azure Functions
- Azure App Service
- Application Gateway WAF
- Front Door
- queues beyond the database-backed pattern
- additional services or containers
- WebSockets

## Avoid by default
- extra infrastructure without demonstrated need
- alternate data stores without clear requirement
- frontend-hosted orchestration logic
- complicated multi-service designs for modest business apps
- platform divergence without strong reason
- RabbitMQ or other broker technologies as the baseline
- cron inside containers
