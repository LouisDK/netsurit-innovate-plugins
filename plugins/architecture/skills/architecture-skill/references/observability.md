# Observability

Standard observability model for **single-tenant Azure applications**. Every production-oriented application must produce enough telemetry to be operated, debugged, and supported without guesswork. Observability is part of the architecture, not an optional extra.

Complements: `SKILL.md`, `architecture.md`, `security.md`, `data-patterns.md`, `deployment.md`

Goals: make systems supportable by a small team, reduce variance across applications, provide consistent diagnostics across web/orchestrator/jobs/schedules, support AI workloads with useful tracing, and align with Azure-native tooling without tight vendor coupling.

---

# Standard Observability Stack

- **OpenTelemetry** for instrumentation
- **Azure Monitor** as the operational observability platform
- **Application Insights** for application telemetry and performance analysis
- **Log Analytics** for centralized query, investigation, and cross-resource analysis

Applications should be instrumented using OpenTelemetry and telemetry exported into Azure's monitoring stack. This separates **how telemetry is produced** from **where it is stored, queried, and visualized**, giving cleaner architecture and better long-term flexibility.

---

# Observability Principles

- **Supportability first** — the system must answer: Is it healthy? What is failing? Where is the latency? Which dependency or AI stage is the problem? Which user flow or job is affected?
- **Consistency across solutions** — all applications follow the same observability pattern. Drift here quickly becomes operational pain.
- **Instrument once, use everywhere** — the same events should support local debugging, production diagnostics, alerting, capacity analysis, support investigations, and cost analysis for AI workloads. Avoid ad hoc logging useful in only one context.
- **Structured over ad hoc** — prefer structured logs, explicit spans, and typed metadata over free-form text. Free-form logs are harder to query, correlate, and standardize.
- **Baseline before sophistication** — meet the observability baseline before adding advanced dashboards or complex alerting. A small consistent signal set everywhere beats an elaborate setup in only a few apps.

---

# Required Baseline

Every production-oriented application should include at minimum:

- structured logs
- request correlation IDs
- distributed traces across web and orchestrator
- health endpoint(s)
- readiness endpoint(s)
- baseline metrics for latency, throughput, and failures
- database interaction visibility
- external dependency visibility
- background job telemetry
- scheduled task telemetry
- deployment and version traceability

---

# OpenTelemetry Standard

OpenTelemetry is the preferred instrumentation standard for traces, metrics, and logs. It avoids each application inventing its own telemetry shape or binding too tightly to one SDK.

**Where to instrument:** both the web container and the orchestrator container. Dedicated worker processes for background jobs or scheduled tasks should also be instrumented.

**What to instrument:**
- inbound and outbound HTTP requests
- database calls
- background job and scheduled task execution
- file storage interactions where relevant
- external service integrations
- authentication and authorization failures
- key business workflow steps
- AI/LLM interactions where applicable

Instrumentation should reflect real operational boundaries, not just framework defaults.

---

# Correlation and Trace Context

**Request correlation** — every inbound request needs a correlation identifier that is created if missing, flows through web and orchestrator layers, attaches to logs and spans, propagates to background jobs where possible, and is available during support investigations.

**Job and schedule correlation** — background jobs and scheduled tasks should carry trace context. At minimum, a unit of work should be traceable to: the source action or trigger, the job/schedule definition, the specific execution attempt, and any downstream dependency calls.

**Deployment correlation** — telemetry should include version or release identifiers (deploys, image versions, commit hashes, migration changes) so operators can correlate incidents with releases.

---

# Logging Standard

## Structured log fields

Logs should be structured and machine-queryable with fields such as:
- timestamp, severity, service name, environment
- correlation ID, trace ID, span ID
- route or operation name
- user or tenant context where appropriate and safe
- job ID or schedule ID where relevant
- dependency target
- error type, error code
- duration where applicable

```typescript
logger.info({
  msg: "job completed",
  jobId, jobType: "report-export",
  durationMs: Date.now() - startedAt,
  correlationId: req.correlationId,
});
```

## What to log

- startup and shutdown
- configuration validation failures
- authentication and authorization failures
- dependency failures and retries
- circuit-breaking or fallback behavior
- background job and scheduled task claim/start/complete/fail events
- significant business workflow failures
- deployment-time migration outcomes

## What not to log

- secrets, tokens, passwords, connection strings
- sensitive personal data unless explicitly approved
- raw prompt or response content by default
- large payloads unless strongly justified with approved data handling

## Log levels

- **Debug** — local or deep diagnosis
- **Info** — important normal lifecycle events
- **Warn** — recoverable issues or degraded behavior
- **Error** — failed operations
- **Fatal** — unrecoverable termination only

Avoid logging expected conditions as errors.

---

# Tracing Standard

Applications should emit distributed traces showing the path of a request or unit of work across web, orchestrator, database, external APIs, storage, background jobs, scheduled tasks, and AI providers. This is especially important in the two-container architecture where requests cross service boundaries.

**Create spans for:**
- inbound requests and orchestrator workflow steps
- database operations and external HTTP calls
- blob operations where meaningful
- queue/job and schedule claim and execution
- AI retrieval steps, model calls, tool calls
- retry/fallback blocks where meaningful

```typescript
const span = tracer.startSpan("db.query", {
  attributes: { "db.statement": "SELECT ...", "db.system": "postgresql" },
});
try { /* ... */ } finally { span.end(); }
```

Avoid noise-heavy spans for every tiny internal helper.

**Span attributes:** service name, route/operation, dependency name, status, duration, retry count, job type, schedule name, model/provider name, token counts where available, result classification (success, retry, timeout, failure). Keep attributes consistent enough for shared dashboards across applications.

---

# Metrics Standard

Every application should expose enough telemetry to answer: How much traffic? How long are requests taking? What is failing? Are jobs accumulating? Are schedules on time? Are AI requests getting slower or more expensive?

**Baseline metrics:**
- request count, latency, and error rate
- dependency latency and failure rate
- active/background job count and queue depth where applicable
- schedule delay or missed schedule count where applicable
- AI request latency and token usage where available

Do not emit metrics just because they are easy to collect. Metrics should answer operational questions or support alerts.

---

# Health and Readiness

- **Health endpoint** (`/api/health`) — lightweight liveness check suitable for container probes. Should not perform deep expensive checks.
- **Readiness endpoint** (`/api/ready`) — indicates ability to serve traffic. May include lightweight checks: required configuration present, database connectivity available, critical dependencies reachable.
- **Diagnostics** — deeper operational checks should be separate from health/readiness probes. Do not overload probes with expensive dependency traversal.

---

# Background Jobs and Scheduled Tasks

**Jobs must be observable.** Every job execution should emit telemetry for: job type, job ID, attempt count, queued/start/completion time, failure reason, retry outcome, dead-letter outcome if applicable, and correlation back to the originating request or schedule.

**Schedules must be observable.** Emit telemetry for: schedule discovery/claim, enqueue of resulting work, execution start/success/failure, next-run calculation, and missed or delayed runs. Scheduled work should be diagnosable with the same confidence as interactive requests.

---

# AI and LLM Observability

AI-enabled applications often degrade in ways not obvious from ordinary request logs — retrieval quality, model latency, token usage, provider throttling, and tool execution all matter.

**Minimum AI telemetry:** model/provider name, latency, token usage, retry count, timeout/throttling events, tool invocations, retrieval stages, fallback path usage, success/failure outcome.

**Prompt and response logging** — do not log full prompts or responses by default. If capture is required, it should be explicitly justified, reviewed for privacy/security, and scoped to minimum retention.

**Streaming telemetry** — capture whether streaming started, completed, or was interrupted, and total stream duration. Streaming failures are otherwise easy to misdiagnose.

---

# Dashboards and Operational Views

Each production application should have a minimum operational view covering: request volume, error rate, latency, dependency failures, job/schedule failures, AI call latency where applicable, and recent deploy/version context.

Reuse common naming and dimensions (service name, environment, route/operation, dependency type, job type, schedule name, AI model/provider) so support teams are not learning a different monitoring shape per application.

---

# Alerting Guidance

Start with a small, focused alert set that operators will actually trust:
- application unavailable or readiness failures
- sustained high error rate or latency increase
- repeated job failures or growing queue depth
- missed or failing scheduled tasks
- repeated AI provider failures or severe degradation

Alerts should be actionable — do not alert on signals that do not imply an action. Avoid noisy alerts that trigger constantly during normal variation.

---

# Local Development and Lower Environments

Use the same instrumentation model in local and non-production environments, even if export paths or retention differ. This helps teams debug issues earlier, validate traces and logs before production, and avoid "only breaks in prod" observability gaps.

All telemetry should include clear environment tags so production and non-production data can be separated cleanly.

---

# Security and Privacy in Observability

- **Data minimization** — only collect telemetry needed for supportability, diagnosis, and improvement. Observability should not become an accidental shadow data store.
- **Secret-safe telemetry** — never emit secrets, keys, tokens, raw connection strings, sensitive headers, or protected configuration values.
- **Sensitive user and business data** — minimize sensitive identifiers and payloads. Prefer stable internal IDs over broad personal data where possible.

---

# Closing: Checklist, What Good Looks Like, and Evolution

**Production checklist:** OpenTelemetry instrumentation in web and orchestrator, structured logs, trace/span propagation, correlation IDs, Azure Monitor / Application Insights / Log Analytics export, `/api/health` and `/api/ready` endpoints, request metrics, dependency telemetry, job telemetry, schedule telemetry, AI telemetry where relevant, version/deployment tagging, a basic operational dashboard, and a small useful alert set.

**What good looks like:** a support engineer or developer can identify system health, trace a request across web/orchestrator/dependencies, determine whether a job failed and why, see whether scheduled tasks ran on time, understand which dependency is slow, see whether an AI call failed in retrieval/model/tool use, and correlate an incident with a deploy. If the system cannot answer those questions, observability is incomplete.

**Evolution:** start with the baseline first — structured logs, tracing, correlation, health/readiness, job/schedule telemetry, and AI telemetry are part of the standard architecture, not a later phase. Advanced additions (custom dashboards, performance profiling, SLO dashboards, anomaly detection, cost analytics, AI evaluation telemetry) can be layered on when justified.
