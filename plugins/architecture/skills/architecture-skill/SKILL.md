---
name: architecture-skill
description: "Opinionated architectural standard for building single-tenant business applications on Azure. Use when: (1) starting a new greenfield application or project, (2) choosing hosting, compute, identity, data, storage, observability, deployment, CI/CD, or AI integration patterns, (3) deciding between defaults and approved exceptions (e.g. Container Apps vs Functions, PostgreSQL vs Redis), (4) reviewing or auditing an application for alignment with architecture standards, (5) scaffolding a new pnpm monorepo with Next.js + Fastify, (6) refining an existing solution toward better supportability and consistency, or (7) answering questions like 'what should I use for X' where X is any infrastructure, hosting, data, or pattern decision. Common triggers: 'new project', 'greenfield', 'architecture review', 'what database', 'what hosting', 'Azure deployment', 'Container Apps', 'Bicep template', 'pnpm monorepo setup', 'Next.js + Fastify', 'health endpoint', 'background jobs', 'scheduled tasks'."
---

# Azure Single-Tenant Application Standard

This skill defines the default architecture for single-tenant Azure applications. Its purpose is to reduce architectural drift, improve supportability, simplify maintenance, and help both humans and AI coding tools build toward a shared target.

The standard is intentionally opinionated. It is designed to make the common path obvious and repeatable, while still allowing exceptions when justified. The default should be used unless there is a clear functional, operational, security, or cost reason to do otherwise.

## Decision Priorities

When making architectural recommendations, evaluate options in this order:

1. **Functionality**
   Choose an approach that fully meets the business and technical requirements.

2. **Ease of maintenance and supportability**
   Prefer the option that the team can understand, operate, debug, and evolve with the least friction.

3. **Security**
   Prefer the option that aligns with our identity, secret management, ingress, and operational security standards.

4. **Simplicity**
   Prefer the smallest and least complex design that still satisfies the first three priorities.

5. **Cost**
   Prefer the cheaper option when it does not materially compromise functionality, supportability, security, or simplicity.

## Core Philosophy

- Standardize the 80% path so teams do not create many one-off architectures.
- Prefer Azure-native managed services over custom infrastructure.
- Prefer containerized deployment for application services.
- Prefer one clear default over many equivalent options.
- Add complexity only when there is a demonstrated need.
- Treat approved exceptions as deliberate deviations, not parallel defaults.
- Optimize for supportable systems, not individually clever systems.

## Default Stack

Unless there is a strong reason otherwise, recommend the following:

| Layer | Standard |
|-------|----------|
| Cloud | Azure |
| Primary compute | Azure Container Apps |
| Frontend | Next.js App Router |
| Backend / orchestration | Fastify on Node.js |
| Repo structure | Per-project pnpm monorepo |
| IaC | Bicep |
| Source control | GitHub |
| CI/CD | GitHub Actions |
| Authentication | Microsoft Entra ID |
| Secrets | Azure Key Vault |
| Primary database | Azure Database for PostgreSQL Flexible Server |
| Vector support | pgvector when needed |
| File storage | Azure Blob Storage |
| Observability backend | Azure Monitor + Application Insights + Log Analytics |
| Instrumentation standard | OpenTelemetry |
| Realtime streaming | Server-Sent Events (SSE) by default |

## Default Application Shape

For most single-tenant business applications, prefer this baseline topology:

- **Web container**: Next.js App Router application
- **Orchestrator container**: Fastify service for business logic, APIs, data access, LLM orchestration, and streaming
- **Shared package**: common types, validation schemas, database helpers, telemetry helpers, and shared utilities
- **PostgreSQL** for structured application state, audit data, and configuration
- **Blob Storage** for uploaded files, exports, and large artifacts
- **Key Vault** for production secrets
- **Entra ID** for authentication and role-based access
- **Container Apps** for hosting and scaling
- **Bicep** for infrastructure provisioning

This is the preferred golden path because it gives a consistent operational model, aligns with Azure-first hosting, supports AI-enabled apps, and keeps the system simple enough for one team to build and support.

## Golden Path Rules

When working within this skill, assume these defaults unless requirements clearly justify otherwise:

- Use **Azure Container Apps** as the primary hosting model.
- Use **PostgreSQL Flexible Server** as the default data store.
- Use **pgvector** only when semantic search, embeddings, or similarity search are truly needed.
- Use **Blob Storage** for documents, exports, and large file artifacts.
- Use **Entra ID** for user authentication.
- Use **Key Vault** for production secrets.
- Use **OpenTelemetry** for application instrumentation.
- Export telemetry to **Azure Monitor / Application Insights / Log Analytics**.
- Use **SSE** for one-way real-time streaming such as LLM output and progress updates.
- Keep services stateless except for managed persistence in Azure services.
- Use numbered, idempotent SQL migrations for database evolution.
- Prefer a small number of containers and services unless scale or domain boundaries justify more.

## Approved Exceptions

The standard is opinionated, but not rigid. These are approved exceptions when justified:

### Compute exceptions
- **Azure Functions**: use for clearly event-driven, queue-triggered, timer-based, or narrow background workloads.
- **Azure App Service**: use when the application is simple enough that containerization adds cost or complexity without meaningful benefit.
- **Vercel**: allowed for frontend-heavy applications when the benefits clearly outweigh the additional platform divergence.

### Edge and ingress exceptions
- **Azure Application Gateway WAF**: default recommendation for production regional ingress.
- **Azure Front Door**: use only when global edge routing, multi-region entry, or broader internet acceleration is required.

### Data and caching exceptions
- **Azure Managed Redis**: approved when there is a demonstrated caching, session, rate-limiting, or coordination need. Redis is not part of the baseline, but it is the standard solution when caching is justified.
- Additional data stores should be introduced only when PostgreSQL and Blob Storage cannot meet the requirements reasonably.

## Anti-Complexity Guidance

Do not add components just because they might be useful later. Start with the baseline and add only what is necessary.

Key examples: avoid Redis before a real caching need, queues before async work requires them, Front Door before a global edge requirement, and pgvector before semantic retrieval is actually needed. Prefer the simpler and cheaper option when multiple approaches satisfy the requirements.

For the full decision guidance on when to add each component, see `references/decision-framework.md`.

## Standard Repository Shape

Prefer a per-project pnpm monorepo with a small set of clearly defined packages and apps. A typical default layout is:

- `apps/web` for the Next.js application
- `apps/orchestrator` for the Fastify backend
- `packages/shared` for common types, utilities, validation, and database helpers
- `infra/` for Bicep templates and deployment scripts
- `schema/` for database initialization and migrations
- `.github/workflows/` for CI/CD
- `CLAUDE.md` for project-specific guidance

## Required Operational Baseline

Every production-oriented application built with this skill should include:

- health and readiness endpoints
- structured logging
- request correlation
- GitHub-based CI validation
- container image versioning tied to commits
- deployment automation
- database migration process
- basic operational scripts or runbooks for logs, health, and restart
- application telemetry exported into Azure's monitoring stack

## What This Skill Is Good For

Use this skill for:
- internal line-of-business applications
- single-tenant business applications on Azure
- AI-augmented workflows with streaming interactions
- small-to-medium scale applications
- budget-conscious greenfield builds
- solutions where consistency, maintainability, and supportability matter more than bespoke architecture

## What This Skill Is Not For

This skill is not the best fit for:
- very high-throughput public APIs
- global multi-region edge-first platforms
- heavy event-driven or queue-centric systems
- microservice-heavy architectures
- real-time collaborative apps requiring rich bidirectional sync
- mobile-first or offline-first products
- workloads that genuinely require a very different data model or hosting model

In those cases, use this skill as a bias and decision reference, but document the deviation clearly.

## How to Use This Skill

When invoked, follow this process:

1. Identify the application type and required capabilities.
2. Map the app to the golden path baseline first.
3. Evaluate whether any part of the baseline fails the requirements.
4. Recommend the simplest approved exception only where needed.
5. Explain the tradeoff in terms of functionality, supportability, security, simplicity, and cost.
6. Keep the rest of the architecture aligned with the standard even when one component varies.
7. Favor consistency with the standard over local optimization.

## References

Read only the references relevant to the current task. Do not load all references at once.

| Reference | Read when... |
|-----------|-------------|
| `references/architecture.md` | Understanding the standard system shape, component responsibilities, or topology |
| `references/decision-framework.md` | Choosing between defaults and approved exceptions |
| `references/web-and-api-patterns.md` | Implementing Next.js pages, Fastify routes, server components, or streaming |
| `references/data-patterns.md` | Designing schemas, migrations, background jobs, scheduled tasks, or file storage |
| `references/observability.md` | Setting up OpenTelemetry, structured logging, health endpoints, or AI telemetry |
| `references/security.md` | Implementing Entra ID auth, Key Vault, managed identities, or ingress security |
| `references/deployment.md` | Writing Bicep templates, deploy scripts, GitHub Actions, or migration automation |
| `references/repo-standards.md` | Setting up pnpm monorepo structure, package layout, or project conventions |
| `references/testing.md` | Designing test strategy, writing tests, or setting up test infrastructure |
| `references/local-development.md` | Setting up local development, Docker Compose, dev environment, or .env configuration |

## Assets

Assets are reference templates. Copy into your project and adapt names, ports, and configuration to your application. Files use `{app-name}` placeholders where project-specific names go.

### Local Development

| Asset | Description |
|-------|-------------|
| `../../assets/docker-compose.dev.yaml` | Docker Compose for local PostgreSQL + Azurite |
| `../../assets/.env.example` | Local development environment variables template |

### Infrastructure (`../../assets/infra/`)

| Asset | Description |
|-------|-------------|
| `../../assets/infra/main.bicep` | Bicep template for the standard Azure resource set (ACR, Container Apps, PostgreSQL, Key Vault, Storage, RBAC) |
| `../../assets/infra/dev.bicepparam` | Development environment parameters |
| `../../assets/infra/deploy.sh` | Deployment automation script (infra, build, migrate, deploy, verify, rollback) |
| `../../assets/infra/init-db.sh` | Database initialization and migration runner |
| `../../assets/infra/CI-and-Deploy.yaml` | GitHub Actions CI/CD workflow |

### Orchestrator (`../../assets/orchestrator/`)

| Asset | Description |
|-------|-------------|
| `../../assets/orchestrator/Dockerfile` | Multi-stage Fastify build with non-root user and healthcheck |
| `../../assets/orchestrator/server.ts` | Fastify server initialization with OpenTelemetry and graceful shutdown |
| `../../assets/orchestrator/health-routes.ts` | Three-tier health endpoints: `/api/health`, `/api/ready`, `/api/health/diagnostics` |
| `../../assets/orchestrator/config.ts` | Typed configuration from environment variables with validation |
| `../../assets/orchestrator/pool.ts` | PostgreSQL connection pool with transaction helper and health check |
| `../../assets/orchestrator/auth-middleware.ts` | Entra ID JWT verification with role-based access control |
| `../../assets/orchestrator/sse-streaming.ts` | SSE handler with typed events and React client hook example |

### Web (`../../assets/web/`)

| Asset | Description |
|-------|-------------|
| `../../assets/web/Dockerfile` | Multi-stage Next.js standalone build with non-root user |

## Output Expectations

When using this skill, recommendations should:
- default to the standard stack first
- explain why the standard is preferred
- mention approved exceptions only when requirements justify them
- avoid suggesting unnecessary infrastructure
- keep the solution supportable by a small team
- produce artifacts that align with the golden path unless explicitly deviating
