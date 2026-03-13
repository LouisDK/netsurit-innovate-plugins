---
name: ns-appfoundry-check
description: "Quick standards compliance check for Azure single-tenant applications. Run this skill when a developer asks to check their project against the architecture standard, wants a quick compliance scan, says 'check my repo structure', 'architecture check', 'standards check', 'compliance check', 'does my project follow the standard', or invokes /ns-appfoundry-check. Also trigger when a developer mentions wanting to verify their project layout, check for drift, or assess structural alignment — even if they don't use the exact command name. This is the fast, lightweight counterpart to the deeper code review skill: it scans the file system directly for structural patterns rather than performing deep code analysis."
---

# Architecture Standards Quick Check

A fast, lightweight compliance check that scans a project's file system for alignment with the Netsurit Azure application standard. Think of it as a structural health check — it looks at what directories exist, what files are present, and whether the project shape matches the standard layout.

This skill scans the file system directly using Glob, Grep, and Read tools. It does not spawn the Architecture Lens subagent — that deeper analysis is the job of `/ns-appfoundry-code-review`. The check skill is designed for speed: run it mid-implementation to catch unintentional drift before it accumulates.

## Philosophy

This skill embodies the "helpful colleague" approach. It points out where a project could align more closely with the standard, explains why each pattern exists, and acknowledges intentional deviations positively. It never uses words like "violation," "non-compliant," or "failed" — those belong in compliance tools, not in a colleague's feedback.

The standard is opinionated but not rigid. Registered deviations are respected. Unregistered deviations are flagged with context, not judgment.

## When to Run

- After scaffolding a new project — verify the generated structure
- Mid-sprint — catch drift before code review
- After significant refactoring — confirm structural integrity
- When onboarding to an unfamiliar project — understand its alignment at a glance

## Files Read

- **Project directories and files** — scans for standard layout directories (`apps/`, `infra/`, `schema/`, etc.) and top-level files (`CLAUDE.md`, `package.json`, etc.)
- **`docs/architecture-deviations.md`** — deviation registry in the consumer project (if it exists)
- **Health endpoint files** — `health-routes.ts`, `health.ts`, or similar in the server source tree
- **Dockerfiles** — `Dockerfile` files in `apps/orchestrator/`, `apps/web/`, or elsewhere
- **Pool helper files** — `pool.ts`, `db.ts`, `database.ts`, or similar in the server source tree
- **Auth middleware files** — `auth-middleware.ts`, `auth.ts`, or similar in the server source tree
- **`package.json`** — checked for database dependencies (`pg`) and framework signals (`fastify`, `express`)
- **`references/repo-standards.md`** — loaded on demand when additional context is needed during a check

This skill writes nothing — it is read-only.

## How This Skill Works

When invoked, follow these steps in order:

### Step 1: Establish Context

Determine the project root directory. This is typically the current working directory. Look for signals that confirm it's a project root: `package.json`, `CLAUDE.md`, `.git/`, `pnpm-workspace.yaml`, or an `apps/` directory.

If the current directory doesn't look like a project root (none of these signals found), inform the developer and ask them to confirm the correct path.

### Step 2: Check for Deviation Registry

Look for `docs/architecture-deviations.md` in the project root. If it exists, read it and parse the deviation entries. Each entry has a sequential ID (DEV-NNN), a pattern domain/concern, the standard recommendation, the chosen alternative, rationale, and status (Active/Resolved).

Store the active deviations for cross-referencing during checks. When a finding matches a registered deviation, acknowledge it positively instead of flagging it as drift:

> "Registered deviation (DEV-001): This project uses [alternative] instead of [standard]. Rationale: [from registry]. This is an intentional, documented decision."

If no registry exists, that's fine — it's optional. Note its absence in the summary but don't treat it as a finding.

### Step 3: Run Repository Structure Assessment

Use the Glob tool to check for the standard directory structure and files. The standard layout from `repo-standards.md` defines what a well-structured project looks like:

**Core directories to check:**

| Directory/File | What it means | Severity if missing |
|---|---|---|
| `apps/` | Application containers — the fundamental project shape | Critical deviation — the project's container structure is unclear |
| `apps/web/` | Next.js frontend container | Significant deviation — frontend location is non-standard |
| `apps/orchestrator/` | Fastify backend container | Significant deviation — backend location is non-standard |
| `packages/shared/` | Shared code between containers | Pattern opportunity — shared code may exist elsewhere or not be needed yet |
| `infra/` | Bicep templates and deployment assets | Significant deviation — infrastructure-as-code should live with the application |
| `schema/` | Database initialisation and migrations | Significant deviation — database schema management location is unclear |
| `.github/workflows/` | CI/CD pipeline definitions | Drift — CI/CD should be configured for consistent delivery |

**Top-level files to check:**

| File | What it means | Severity if missing |
|---|---|---|
| `CLAUDE.md` | Project-specific AI development guidance | Drift — without this, AI tools lack project context |
| `package.json` | Workspace root manifest | Significant deviation — the monorepo has no root configuration |
| `pnpm-workspace.yaml` | Workspace package definitions | Pattern opportunity — pnpm workspace may not be configured yet |
| `README.md` | Project documentation entry point | Pattern opportunity — documentation helps onboarding |
| `tsconfig.base.json` | Shared TypeScript configuration | Pattern opportunity — TypeScript consistency across packages |

For each check, use the Glob tool to verify presence. When something is missing, create a finding using the format described in the Output Format section.

If a parent directory is missing (e.g., `apps/`), do not separately report its child directories (`apps/web/`, `apps/orchestrator/`). The parent finding subsumes them — reporting both is redundant noise.

When something is present, do not create a finding — only report what needs attention. A clean check should produce few or no findings.

**Cross-reference each finding against the deviation registry.** If a missing element matches a registered active deviation, convert the finding to a positive acknowledgment instead.

### Step 4: Check Health Endpoint Patterns

Health and readiness endpoints are how Azure Container Apps knows your service is alive and ready for traffic. Every production service needs them.

Use Glob to search for health-related files: `**/health*.ts`, `**/health*.js`, `**/health-routes*`. Check both `apps/orchestrator/` and `apps/web/` trees if they exist.

If a health file is found, use Grep to look for `/api/health` or `/health` and `/api/ready` or `/ready` route definitions.

**If Step 3 flagged `apps/` as missing, skip location-specific health checks** — the parent finding already covers the structural gap.

| Condition | Severity | Why |
|---|---|---|
| No health endpoint file found | Significant deviation | Container orchestrators can't manage the service without liveness probes |
| Health exists but no readiness endpoint | Drift | Readiness tells the platform when the app can actually serve traffic after startup or during dependency outages |
| Health file in non-standard location | Pattern opportunity | A dedicated health routes file keeps probe logic separated and clear |

Cross-reference findings against the deviation registry as in Step 3.

**Reference for findings:** `observability.md § Health and Readiness`

### Step 5: Check Dockerfile Patterns

Containerisation is the standard deployment model for Azure Container Apps. Dockerfiles define how images are built.

Use Glob to find `**/Dockerfile*` in the project. Check whether Dockerfiles exist near `apps/orchestrator/` and `apps/web/`.

If a Dockerfile is found, use Grep to count `FROM` statements — multi-stage builds have 2 or more.

**If Step 3 flagged `apps/` as missing, skip location-specific Dockerfile checks.**

| Condition | Severity | Why |
|---|---|---|
| No Dockerfile found anywhere | Significant deviation | Without Dockerfiles, the project can't build container images for Azure Container Apps |
| Dockerfile exists but single `FROM` (no multi-stage) | Drift | Multi-stage builds keep production images small and secure by separating build dependencies from runtime |
| Only one Dockerfile for both services | Pattern opportunity | Separate web and orchestrator containers allow independent scaling and deployment |

Cross-reference findings against the deviation registry.

**Reference for findings:** `deployment.md § Build and Image Strategy`

### Step 6: Check Connection Pool Setup

**This check is conditional.** First look for database usage signals: check if `"pg"` appears as a dependency name (not substring) in `package.json` dependencies or devDependencies, `DATABASE_URL` references in project files, or a `schema/` directory. If none are found, skip this check and note it in the summary.

The standard centralises database connections through a pool helper (`pg.Pool`) rather than scattering raw `pg.query()` calls across the codebase.

Use Glob to find pool helper candidates: `**/pool.ts`, `**/pool.js`, `**/db.ts`, `**/db.js`, `**/database.ts`, `**/database.js`, `**/connection.ts`, `**/connection.js` in the server/orchestrator source.

If a pool helper is found, use Grep to check whether `pg.query(` or `client.query(` calls appear in other files, suggesting the helper is being bypassed.

| Condition | Severity | Why |
|---|---|---|
| No database usage detected | N/A | Skip — not every project needs a database |
| Database usage detected but no pool helper | Significant deviation | Scattered connection management is harder to configure, monitor, and maintain consistently |
| Pool helper exists but raw `pg` calls in other files | Drift | Routing all queries through the helper ensures consistent connection management |

Cross-reference findings against the deviation registry.

**Reference for findings:** `data-patterns.md § Connection pool helper`

### Step 7: Check Auth Middleware Patterns

**This check is conditional.** First look for backend API signals: `fastify`, `express`, route definitions, or an `apps/orchestrator/` directory with source files. If no backend API is detected, skip this check and note it in the summary.

The standard requires authentication middleware that verifies Entra ID JWT tokens, registered as a Fastify hook or Express middleware, attaching user context to requests.

Use Glob to find auth middleware candidates: `**/auth-middleware*`, `**/auth.ts`, `**/auth.js`, `**/middleware/auth*` in the server/orchestrator source.

If found, use Grep to check for token verification signals (`verify`, `jwt`, `token`, `Bearer`, `onRequest`, `preHandler`). Also look for Entra ID signals (`entra`, `msal`, `azure-ad`, `microsoft`, `openid`, `oid`).

| Condition | Severity | Why |
|---|---|---|
| No backend API detected | N/A | Skip — project may be frontend-only |
| Backend has API routes but no auth middleware | Significant deviation | API endpoints are effectively unprotected without authentication middleware |
| Auth middleware exists but no Entra ID signals | Drift | Cross-reference the deviation registry first — the project may use an alternative auth provider that should be registered |

If auth middleware exists with Entra ID signals, no finding is generated — the pattern is aligned.

Cross-reference findings against the deviation registry.

**Reference for findings:** `security.md § Identity and Authentication`

### Step 8: Present Results

After all checks complete, present findings using the output format below. Group findings by severity (critical first, then significant, drift, pattern opportunities). Follow with the summary.

If there are no findings, congratulate the developer — their project is well-aligned with the standard.

## Output Format

Present each finding in this structure:

```
### [Severity Label] Category — What Was Found

**Observation:** [What the check found — specific and factual]
**Standard:** [What the standard recommends and where]
**Why this matters:** [Brief explanation of the pattern's purpose — why it exists, not just that it should]
**Reference:** [reference-domain].md § [Section Name]
**Registry:** [Registered (DEV-NNN) | Unregistered | N/A]
```

**Example finding:**

```
### [Drift] Repository Structure — Missing CLAUDE.md

**Observation:** No CLAUDE.md file found at the project root.
**Standard:** Every project should have a CLAUDE.md with project-specific guidance for AI-assisted development.
**Why this matters:** CLAUDE.md gives AI coding tools the local context they need — conventions specific to this project, architectural constraints, common tasks, and domain rules. Without it, AI tools fall back on generic patterns that may not match your project's decisions.
**Reference:** repo-standards.md § Top-Level Files
**Registry:** N/A
```

**Example registered deviation:**

```
### [Registered] Repository Structure — Alternative Frontend Location (DEV-003)

**Observation:** Frontend is at `src/frontend/` instead of `apps/web/`.
**This is a registered deviation** (DEV-003): The team chose a flat source structure because this project has only one deployable unit. Rationale documented in the deviation registry.
**Reference:** repo-standards.md § apps/ Directory
```

## Summary Format

After all findings, present a summary:

```
## Check Summary

| Severity | Count |
|----------|-------|
| Critical deviation | 0 |
| Significant deviation | 1 |
| Drift | 2 |
| Pattern opportunity | 1 |
| Registered (acknowledged) | 1 |

**Overall:** [One-sentence assessment — e.g., "Mostly aligned with the standard. A couple of structural gaps worth addressing when convenient."]

**Checks performed:** Repository structure, Health endpoints, Dockerfiles, Connection pools, Auth middleware
**Checks skipped:** [List any conditional checks that were skipped with reason, e.g., "Connection pools (no database detected)"]
**Deviation registry:** [Found (N active deviations) | Not found]
```

## Severity & Tone Reference

These four levels are shared across all architecture plugin tools. Use them consistently:

| Level | Label | Meaning | Tone example |
|---|---|---|---|
| 1 | Pattern opportunity | Could follow the standard more closely, but works fine | "You might consider..." |
| 2 | Drift | Deviates without clear justification — likely unintentional | "This doesn't match the standard pattern — worth aligning" |
| 3 | Significant deviation | Meaningful departure affecting maintainability or consistency | "This diverges from the standard in a way that will affect..." |
| 4 | Critical deviation | Breaks a core pattern or creates operational/security risk | "This needs attention — it conflicts with..." |

The check skill runs in a mode similar to the lens agent's "review" mode — findings include severity ratings and actionable recommendations. But tone is always collegial: explain why the pattern exists, never just state that it should.

## Check Areas

This skill covers five pattern domains:

1. **Repository structure** — monorepo layout, expected directories and top-level files
2. **Health endpoints** — liveness and readiness probes for container orchestration
3. **Dockerfile patterns** — containerisation, multi-stage builds, separate service images
4. **Connection pools** — centralised database connection management (conditional)
5. **Auth middleware** — authentication middleware with Entra ID integration (conditional)

All check areas use the same finding format and severity vocabulary.

## References

Read only when additional context is needed during a check:

| Reference | Read when... |
|---|---|
| `references/repo-standards.md` | Detailed repository layout rules, naming conventions, or package guidance |
| `references/observability.md` | Health endpoint patterns, readiness checks, or production observability baseline |
| `references/deployment.md` | Dockerfile patterns, container build strategy, or CI/CD pipeline expectations |
| `references/data-patterns.md` | Connection pool setup, database access patterns, or schema management |
| `references/security.md` | Auth middleware patterns, Entra ID integration, or authorization approaches |

## What This Skill Does Not Do

- **Deep code analysis** — use `/ns-appfoundry-code-review` for pattern-level code review via the Architecture Lens agent
- **Generate or modify files** — this skill is read-only, it reports findings but changes nothing
- **Require BMAD** — this skill works in any project, whether or not BMAD is installed
- **Replace code review** — this is a quick structural pulse check, not a substitute for thorough review
