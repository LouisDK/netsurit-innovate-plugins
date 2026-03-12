# Data Patterns

Standard data patterns for **single-tenant Azure applications** built on the Azure Single-Tenant Application Standard. Ensures consistent use of data storage, file storage, jobs, schedules, and schema evolution across teams.

Complements: `SKILL.md`, `architecture.md`, `decision-framework.md`, `deployment.md`, `security.md`, `observability.md`

---

# Data Principles

- **PostgreSQL first** — Azure Database for PostgreSQL Flexible Server is the default system of record for structured data. Assume state belongs in PostgreSQL unless there is a strong reason otherwise.
- **Blob Storage for files** — Azure Blob Storage holds files and large binary artifacts. The database stores metadata and references; Blob Storage stores content. Do not store uploaded files, exports, images, documents, or large payloads in the database.
- **Add complexity only when justified** — Do not introduce another database, document store, queue technology, scheduler, or caching-backed state system unless PostgreSQL and Blob Storage cannot reasonably satisfy the requirement.
- **Explicit over implicit** — Prefer explicit schemas, migrations, job states, schedule states, foreign keys, and lifecycle fields. Avoid designs where state hides in ad hoc JSON blobs or is spread across many storage systems.
- **Durable and observable** — Data patterns should support auditability, safe retries, operational visibility, predictable migrations, failure diagnosis, and AI-assisted development against a known shape.

---

# Standard Storage Model

- **PostgreSQL** for structured application data
- **Blob Storage** for file content and large artifacts
- **pgvector** only when semantic retrieval is actually required
- **PostgreSQL jobs table** for background work
- **PostgreSQL schedule table** for recurring work
- **Azure Managed Redis** only when caching or coordination is justified

This gives the platform a small, consistent data surface.

---

# PostgreSQL Patterns

## What belongs in PostgreSQL

Business entities, relational data, configuration, user/application state, workflow state, audit records, AI conversation/session metadata, job and schedule definitions and execution state, file references (content in Blob Storage), and retrieval metadata when using pgvector.

## Schema-first design

Prefer a clear relational schema before reaching for flexible document-like storage. Good default tables often include: users/principals, business domain tables, workflow/process state, audit/event tables, file metadata, jobs, and schedules.

Start by identifying: core entities, ownership relationships, lifecycle states, query patterns, and retention needs.

## Use JSONB deliberately, not lazily

Use JSONB when the shape is naturally flexible or auxiliary. Do not use JSONB for core business fields queried heavily or as a replacement for obvious normalized tables.

Rule: **core shape in columns, flexible edges in JSONB**.

## Primary keys and identifiers

- UUIDs if globally unique identifiers are valuable across services or external boundaries
- bigint identities if simplicity and local relational use matter more
- Be consistent within a project

## Timestamps and lifecycle fields

Most important tables should include `created_at` and `updated_at`. Where relevant, add `deleted_at` (soft delete), `status`, `version` (optimistic concurrency), or workflow timestamps like `processed_at`, `completed_at`, `failed_at`.

---

# Schema Design Guidance

- **Normalize by default** for business data — improves clarity, consistency, referential integrity, and maintainability. Do not denormalize early.
- **Denormalize only for a real reason** — query performance, reporting patterns, materialized views, or significant complexity reduction. Document the source of truth.
- **Use foreign keys** for core business relationships, metadata relationships, file ownership, and workflow state ownership. Skip only when strict enforcement is impractical.
- **Make status fields explicit** — use a clear `status` field (e.g., `draft`, `pending`, `approved`, `completed`, `failed`) rather than encoding state indirectly through nullable columns.

---

# Transactions and Concurrency

- **Use transactions** when multiple related writes must succeed or fail together, including job/schedule claim-and-update operations.
- **Keep transactions short and focused** — limited to the data consistency boundary. Do not hold transactions open while calling external APIs, waiting on LLM responses, doing CPU-heavy work, or streaming. Persist state, commit, then perform long-running work separately.
- **Concurrency control** — use the simplest approach that works: optimistic concurrency with a `version` column, row-level locking for job/schedule claims, or application-level idempotency for retryable workflows.

## Connection pool helper

```typescript
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PG_POOL_MAX ?? "10"),
  idleTimeoutMillis: 30_000,
});
export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params);
```

---

# Migrations

Schema changes must be managed through explicit, versioned migrations. Do not rely on manual production changes, hidden startup-time mutation, or undocumented SQL.

## Structure

- `schema/init.sql` for first-time bootstrap
- `schema/migrations/001_...sql`, `002_...sql`, etc.
- Numbered migrations in a predictable sequence

## Example migration file (`schema/migrations/002_add_jobs.sql`)

```sql
CREATE TABLE IF NOT EXISTS jobs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_type      text NOT NULL,
  status        text NOT NULL DEFAULT 'pending',
  payload       jsonb,
  available_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_claimable
  ON jobs (available_at) WHERE status = 'pending';
```

## Style

Migrations should be reviewable, explicit, traceable to application changes, and safe for deployment pipelines.

## Backward compatibility

Prefer safe rollout order: add nullable column, deploy code writing to both shapes, backfill, switch reads, remove old column later. Do not assume schema rollback is trivial — application rollback is usually easier.

---

# Blob Storage Patterns

Use Blob Storage for uploaded documents, generated reports, images, exports, archives, model artifacts, large AI outputs, and any large binary payload.

**Metadata belongs in PostgreSQL.** For each blob, persist: blob identifier, owning entity, filename, content type, size, checksum, upload timestamp, status, and retention flags. A thin path-only reference is not enough.

**Be explicit about file lifecycle:** upload pending, active, replaced, archived, deleted. Blob Storage should not become a silent accumulation layer with no lifecycle model.

---

# pgvector Patterns

Use **pgvector** only when the application actually needs semantic retrieval, similarity search, embeddings-based lookup, or lightweight RAG. Do not add it merely because the app uses AI.

**Typical model:** a source/document table, chunk metadata, and an embeddings table containing source reference, chunk text/pointer, embedding vector, model/version metadata, and created timestamp.

**Keep retrieval metadata relational** — document ID, chunk ID, source type, owner/tenant scope, indexing version, ingestion status. Do not make the vector table an unstructured dumping ground.

**Plan for model change** with fields like `embedding_model`, `embedding_version`, `indexed_at`, `is_active`.

---

# Jobs Table Pattern

Background work should use a **PostgreSQL-backed jobs table** for imports, exports, report generation, AI background tasks, reconciliation, webhook follow-up, and retryable deferred work.

## Recommended table shape

`id`, `job_type`, `payload` (JSONB), `status`, `priority`, `available_at`, `attempt_count`, `max_attempts`, `locked_by`, `locked_at`, `last_error`, `correlation_id`, `created_at`, `updated_at`, `completed_at`/`failed_at`

## Key patterns

- **State model:** `pending` → `processing` → `completed` | `failed` | `dead_letter`. Use explicit states, not just timestamps.
- **Claiming:** use `FOR UPDATE SKIP LOCKED` so concurrent workers claim work safely:

```sql
UPDATE jobs SET status = 'processing', locked_by = $1, locked_at = now()
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'pending' AND available_at <= now()
  ORDER BY priority, available_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
) RETURNING *;
```

- **Delayed/retryable work:** use `available_at` for delayed execution, retry backoff, and scheduled promotion.
- **Dead-letter:** when a job exceeds retry limits, move to `failed` or `dead_letter`. Do not retry forever silently.

---

# Schedule Table Pattern

Recurring work should use a **PostgreSQL-backed schedules table** that creates normal jobs when work becomes due.

## Recommended table shape

`id`, `job_name`, `enabled`, `schedule_type`/recurrence descriptor, `next_run_at`, `last_run_at`, `last_status`, `last_error`, `payload`, `concurrency_policy`, `created_at`, `updated_at`

## Key patterns

- The scheduler claims due schedules, enqueues normal jobs, computes next run, persists state, and emits telemetry. It should not execute business work inline.
- **Concurrency policy:** define whether to allow overlap, skip if running, enqueue another, or serialize. Do not leave overlapping behavior undefined.

---

# Audit and Event Patterns

Not every table needs a full audit trail, but many business workflows benefit from explicit audit records: approval actions, state changes, admin actions, AI-assisted decisions, file lifecycle events, job/schedule execution summaries.

Audit/event tables work best as append-only with: entity type, entity ID, action/event type, actor, timestamp, details payload, correlation ID. Do not over-engineer eventing where a simple append-only table is enough.

---

# Soft Delete and Retention

- **Soft delete** (`deleted_at`) when recovery matters, business history matters, deletion is logically reversible, or compliance requires it.
- **Hard delete** is valid for ephemeral staging data, retry artifacts, temporary ingestion rows, and derived data that can be recreated.
- Retention should be explicit, not accidental.

---

# Query and Performance Guidance

- **Index deliberately** based on real query patterns: foreign keys, status fields, `created_at`, `available_at`, `next_run_at`, ownership references, vector search support. Avoid speculative indexes.
- **Avoid N+1 and broad over-fetching** — query intentionally, return only what is needed.
- **Start simple before cache layers** — fix query shape, indexes, batching, pagination, materialized views before adding Redis.

---

# Security and Access Patterns

Data access should live in the orchestrator or backend runtime — the web layer should not directly access PostgreSQL or privileged Blob operations. Apply least-access: scoped reads/writes, constrained file access, limited secret access. Be deliberate about storing personal data, tokens, business-sensitive content, or AI prompt/response content. See `security.md` for full guidance.

---

# Observability for Data Operations

Emit telemetry for: migration execution, job lifecycle events, schedule lifecycle events, major query failures, storage failures, vector indexing/retrieval failures. Avoid logging full large payloads, raw embeddings, sensitive file contents, or connection secrets. See `observability.md` for full guidance.

---

# Closing Guidance

## What to avoid

- Multiple databases for one app without strong reason
- Large files in PostgreSQL
- JSONB as a substitute for obvious schema design
- RabbitMQ or another broker for ordinary app jobs
- Cron-in-container for core recurring work
- Schema changes outside versioned migrations
- Blob paths with no meaningful metadata
- pgvector without a real retrieval use case
- Hidden lifecycle state instead of explicit modeling

**Anti-pattern — storing everything in JSONB:**

```typescript
// Bad: core business data hidden in a loose JSONB column
await query("INSERT INTO orders (data) VALUES ($1)", [
  JSON.stringify({ customer, items, status, total }),
]);

// Better: explicit columns for queryable fields, JSONB for extras
await query(
  `INSERT INTO orders (customer_id, status, total, metadata)
   VALUES ($1, $2, $3, $4)`,
  [customer.id, "pending", total, JSON.stringify({ notes })],
);
```

## Baseline checklist

A production-oriented application should include: PostgreSQL as primary store, Blob Storage for files, explicit relational schema, versioned migrations, lifecycle/status fields, jobs table, schedules table, deliberate JSONB usage, pgvector only when needed, file metadata tables, query/index design based on real access patterns, and data access through backend/orchestrator only.

## Litmus test

A team should be able to answer: What is the primary system of record? What lives in PostgreSQL vs Blob Storage? How are schema changes managed? How are jobs persisted and retried? How are scheduled tasks represented? Which tables model lifecycle state? Where is flexible data stored, and why? How would we re-index vectors? How do we trace a failed job or missing file?

## Evolution

Start with the baseline. Do not postpone PostgreSQL-first persistence, blob metadata split, migrations, jobs/schedules tables, lifecycle modeling, or deliberate JSONB usage. More advanced patterns (materialized views, partitioning, archive strategies, richer audit models, specialized vector indexing) can be added later. The goal is not identical data models — it is making most apps similar enough to be easy to build, support, and evolve.