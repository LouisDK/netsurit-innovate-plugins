# Architecture

Standard reference architecture for **single-tenant business applications on Azure**, showing the golden path once architectural choices are made.

Complements: `SKILL.md`, `decision-framework.md`, `web-and-api-patterns.md`, `data-patterns.md`, `security.md`, `observability.md`, `deployment.md`, `testing.md`, `repo-standards.md`, `local-development.md`

Optimized for: internal/enterprise business apps, Azure-first delivery, small-team supportability, consistency across greenfield solutions, AI-enabled workflows, and cost-conscious deployments. Not intended as the ideal architecture for every workload — it is the standard for the majority of single-tenant applications we build.

This architecture is relatively inexpensive at low-to-moderate scale, simple enough for a small team, capable enough for most internal business apps, and structured enough to scale modestly without redesign. That balance of functionality, supportability, security, simplicity, and cost is the point of the standard.

---

# What We Build

**Single-tenant line-of-business applications** for internal or enterprise use, following a consistent baseline:

- **Next.js** frontend
- **Fastify** backend/orchestrator
- **Shared TypeScript package**
- **PostgreSQL** for structured persistence
- **Azure Blob Storage** for files and large artifacts
- **Microsoft Entra ID** for identity
- **Azure Key Vault** for secrets
- **Azure Container Apps** for hosting
- **OpenTelemetry** feeding **Azure Monitor / Application Insights / Log Analytics** for observability

One repeatable, supportable pattern rather than many slightly different application shapes.

---

# System Overview

```text
                         ┌────────────────────────────────────────────────────┐
                         │            Azure Container Apps Environment        │
                         │                                                    │
  Users ─── HTTPS ─────▶ │  ┌──────────────┐      ┌──────────────────────┐   │
                         │  │ Web          │ REST │ Orchestrator         │   │
                         │  │ Next.js      │─────▶│ Fastify              │   │
                         │  │ App Router   │ SSE  │ APIs + business      │   │
                         │  │ Port 3000    │◀─────│ logic + AI flows     │   │
                         │  └──────────────┘      │ Port 3001            │   │
                         │                        └──────────┬───────────┘   │
                         └───────────────────────────────────┼───────────────┘
                                                             │
                              ┌──────────────────┬───────────┼───────────┬─────────────┐
                              │                  │           │           │             │
                         ┌────▼─────┐      ┌─────▼────┐ ┌────▼────┐ ┌────▼──────┐ ┌────▼────────────┐
                         │PostgreSQL │      │Blob      │ │Key Vault│ │Entra ID   │ │Azure Monitor / │
                         │Flexible   │      │Storage   │ │         │ │           │ │App Insights /  │
                         │Server     │      │          │ │         │ │           │ │Log Analytics   │
                         └───────────┘      └──────────┘ └─────────┘ └───────────┘ └─────────────────┘
                                                             │
                                                        ┌────▼──────┐
                                                        │ LLM APIs   │
                                                        │ (if used)  │
                                                        └────────────┘
```

The standard runtime shape is intentionally small: **two containers** — one web, one orchestrator — because most business apps need clean separation between presentation and application concerns but do not need a larger service decomposition.

---

# Why Two Containers

Most business applications have two kinds of responsibilities:

* **Presentation** (web container): UI rendering, routing, SSR, session-aware frontend behavior
* **Application** (orchestrator): business logic, data access, integrations, authorization enforcement, AI orchestration, SSE streaming

**Benefits:**
- **Separation of concerns** — presentation stays focused; business rules, DB access, file handling, integrations, and AI flows live in one place
- **Better supportability** — the two layers fail differently and benefit from separate diagnostics, logs, health checks, and restarts
- **Stronger security** — database access, Blob Storage, API calls, and secrets stay in the orchestrator rather than spreading through UI code
- **Fit for common requirements** — even simple business apps often need structured logic, validation, transactions, file handling, audit, integrations, AI orchestration, and streaming
- **Just enough structure** — more disciplined than all-in-one, much simpler than microservices

**When a single container may work:** very small apps with minimal business logic and few integrations where splitting adds more ceremony than value. Even then, the broader standards (Azure hosting, Entra ID, Key Vault, PostgreSQL, Blob Storage, OpenTelemetry) still apply.

---

# Core Components

## Web container (Next.js App Router)

Renders UI, handles frontend routing and SSR, initiates backend API calls, displays streaming responses. Should stay focused on presentation — not accumulate business rules, direct secret usage, or backend integrations.

## Orchestrator container (Fastify)

Owns business logic, API endpoints, validation, PostgreSQL/Blob Storage integration, LLM orchestration, tool/prompt/retrieval flows, SSE streaming, security enforcement, and structured telemetry. The main home for application behavior.

## Shared TypeScript package

Shared types, validation schemas, DTOs, service contracts, common helpers, database access helpers, and telemetry utilities. Should remain focused — not become a dumping ground for unrelated logic.

## Monorepo structure

The standard monorepo uses pnpm workspaces to tie the containers and shared code together. See `repo-standards.md` for full layout and conventions.

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```jsonc
// root package.json (workspace scripts)
{
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @app/web dev & pnpm --filter @app/orchestrator dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test"
  }
}
```

---

# Data and Storage Model

**PostgreSQL Flexible Server** is the primary system of record for structured data (business entities, relational data, configuration, workflow state, audit records, role metadata, transactional operations, AI-related records). Prefer clear relational schemas; use JSONB only where flexibility is genuinely useful. Use numbered, idempotent SQL migrations. Keep database access in the orchestrator.

**pgvector** — use only when the app genuinely needs semantic retrieval, embeddings, or similarity search. Do not add pgvector just because the app has AI features.

**Azure Blob Storage** — standard location for files, exports, documents, images, and large artifacts. PostgreSQL stores metadata and references; Blob Storage stores content.

**Azure Key Vault** — stores database credentials, API keys, client secrets, and certificates. Production secrets must not live in code or checked-in config.

For detailed data patterns including schema design, migration strategies, and implementation examples, see `data-patterns.md`.

---

# Background Work and Scheduling

Background work defaults to a **PostgreSQL-backed jobs table** processed by the orchestrator or a worker sharing the same codebase. This covers document processing, report generation, imports/exports, webhook follow-up, retries, deferred AI processing, and non-interactive workflows.

Scheduled work defaults to a **PostgreSQL-backed schedule registry** that enqueues normal background jobs when work becomes due — covering recurring reports, syncs, reminders, reconciliation, cleanup, and periodic batch workflows.

Both patterns keep async and scheduled processing inside the standard platform, avoiding broker sprawl and inconsistent approaches across solutions.

**Exceptions:** Dedicated messaging (Azure-native services) when PostgreSQL queueing is insufficient. Azure Functions Timer Trigger for clearly isolated, lightweight, infrastructure-adjacent scheduled tasks. Both should be deliberate and documented.

For full rationale, schemas, and implementation details, see `data-patterns.md` — Jobs Table Pattern and Schedule Table Pattern.

---

# Identity and Access

**Microsoft Entra ID** is the default authentication system — centralized enterprise identity, no application-managed passwords, consistent with Microsoft-centric practices.

**Authorization** should be explicit: app roles in Entra ID, clearly named roles aligned with business responsibilities, backend enforcement. The UI can reflect permissions, but the backend is the enforcement boundary.

**Single-tenant scope** — identity scoped to one Microsoft tenant; data isolation by country, team, business unit, or role as needed. Does not assume multi-tenant SaaS patterns.

For detailed security patterns and guidance, see `security.md`.

---

# Hosting and Runtime

**Azure Container Apps** is the default compute platform — consistent container deployment, managed scaling, good fit for web/backend workloads, simpler than Kubernetes.

Containers standardize local/deployed runtime behavior, build artifacts, CI/CD flow, dependency packaging, and portability. We are not pretending to be cloud-neutral, but containerization gives structural portability without forcing multi-cloud.

**Simplicity principle:** do not split beyond the standard two containers unless clear domain boundaries, scale characteristics, or operational needs justify it.

---

# Observability

Applications should be instrumented with **OpenTelemetry**, sending telemetry to **Azure Monitor / Application Insights / Log Analytics**. Every production app needs: structured logs, request correlation, traces across web and orchestrator, health/readiness endpoints, and baseline metrics (latency, throughput, failures).

**AI telemetry** (when applicable): model/provider, latency, token usage, retries, tool calls, retrieval steps, failure/fallback behavior. Log prompt/response content only with explicit approval and understood data handling.

For detailed observability patterns, see `observability.md`.

---

# Streaming and Real-Time Behavior

**Server-Sent Events (SSE)** is the default streaming mechanism for AI response streaming, progress updates, long-running operation feedback, and server-to-client notifications. SSE is simpler than WebSockets, HTTP-native, and sufficient for most business app streaming needs.

Use WebSockets only when the app truly needs bidirectional low-latency messaging, real-time collaborative state sync, or multi-user interactive coordination that SSE cannot support.

---

# Health and Operations

| Endpoint             | Purpose                          | Used by                       |
| -------------------- | -------------------------------- | ----------------------------- |
| `/api/health`        | Liveness: process is alive       | Container Apps probes         |
| `/api/ready`         | Readiness: app can serve traffic | routing and deployment checks |
| diagnostics endpoint | deeper operational health        | support/admin use             |

**Deployment:** Infrastructure provisioned with **Bicep**. Deployments include infrastructure provisioning, container image build/tagging, database migrations, application deployment, and post-deploy health verification. Should be easy for a small team to understand — traceability matters more than cleverness. See `deployment.md` for the full deployment model.

**Operational tooling:** Each app should have simple scripts for viewing logs, checking health, restarting services, verifying deployment status, and running migrations.

---

# Security Baseline

**Default posture:** Entra ID authentication, Key Vault for secrets, HTTPS everywhere, backend authorization enforcement, managed identities where practical, no secrets in source code, least-privilege service access.

**WAF/ingress:** Azure Application Gateway WAF for regional ingress by default. Azure Front Door when global edge routing is required. Start with the simpler regional pattern unless requirements say otherwise.

**Shared responsibility:** The architecture provides core foundations; application teams still handle authorization logic, sensitive data handling, PII controls, prompt/data hygiene in AI scenarios, and domain-specific audit behavior.

---

# AI Enablement

AI capabilities are optional but supported naturally. When used, AI behavior lives in the **orchestrator**: model invocation, tool calling, retrieval, input/output validation, fallback logic, streaming, and token/cost tracking.

**Retrieval:** Use only when the app needs grounded answers over business content. Store structured metadata in PostgreSQL, files in Blob Storage, and use pgvector only when semantic lookup is truly needed. Do not add retrieval pipelines by default.

---

# Fit and Scope

**Good fit:** internal line-of-business apps, single-tenant enterprise apps, AI-augmented workflows, streaming interfaces, modest-scale systems operated by small teams, greenfield builds where standardization matters.

**Not designed for:** very high-throughput public APIs, global edge-first platforms, heavily event-driven architectures, complex microservice ecosystems, rich real-time collaborative systems, offline-first mobile products, workloads requiring a materially different data model. In those cases, use this architecture as a baseline reference and document the deviation clearly. See `decision-framework.md` for guidance on when and how to deviate.

For frontend and API implementation patterns, see `web-and-api-patterns.md`. For testing strategy, see `testing.md`. For local development setup, see `local-development.md`.
