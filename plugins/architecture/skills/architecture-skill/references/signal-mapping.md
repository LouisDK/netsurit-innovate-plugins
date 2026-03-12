# Smart Reference Signal Mapping

**Purpose:** This file is the centralised keyword-to-reference-file mapping used by all skills that need to determine which architecture reference files to load. When a skill prepares to invoke the Architecture Lens agent or provide architecture guidance, it reads this file, scans source files or context for keyword signals, and selects only the matched reference files — never the full library.

**Who reads this file:** Calling skills (`/ns-appfoundry-code-review`, `/ns-appfoundry-check`, `/ns-appfoundry-scaffold`, `/ns-appfoundry-delta-analysis`, `/ns-appfoundry-onboard`).

**Who does NOT read this file:** The Architecture Lens agent. The lens agent receives already-selected reference files as input. Reference selection is the calling skill's responsibility.

## Signal Mapping Table

Scan source files, story context, or user input for keywords in the **Signal in source/context** column. When a signal matches, load the corresponding reference file.

| Signal in source/context | Reference file loaded |
|---|---|
| SQL, queries, migrations, pool, pg, database, schema | `data-patterns.md` |
| auth, JWT, middleware, Entra, login, RBAC, roles | `security.md` |
| Dockerfile, container, Bicep, deploy, CI/CD, GitHub Actions | `deployment.md` |
| health, logging, telemetry, OpenTelemetry, monitor | `observability.md` |
| Next.js, Fastify, routes, API, SSE, streaming, components | `web-and-api-patterns.md` |
| test, jest, vitest, coverage, E2E, integration test | `testing.md` |
| docker-compose, local dev, .env, dev environment | `local-development.md` |
| monorepo, pnpm, packages, repo structure, CLAUDE.md | `repo-standards.md` |
| architecture, topology, container apps, system shape | `architecture.md` |
| exception, deviation, trade-off, alternative, decision | `decision-framework.md` |

## Matching Rules

When scanning source files or context for signal keywords:

- **Case-insensitive** — "JWT", "jwt", and "Jwt" all match the `security.md` signal group.
- **Whole-word matching** — "pg" matches `pg` but not "page" or "paging". Use word boundaries.
- **Multi-word entries are phrase matches** — "integration test" matches only when both words appear adjacent. "container apps" matches as a phrase (→ `architecture.md`), while bare "container" matches `deployment.md`.
- **Each keyword is independent** — "CI/CD" matches as the literal string "CI/CD". The individual words "CI" and "CD" are not separate signals.
- **Overlapping signals resolve by specificity** — when a keyword matches multiple signal groups, prefer the more specific match. For example, "container apps" (phrase) → `architecture.md` takes precedence over "container" (single word) → `deployment.md`.

## Loading Rules

### 1. Only Matched References

Load only the reference files whose signal keywords appear in the source files or context being analysed. Never load the full reference library.

### 2. Default Fallback

If no keywords match any signal group, load `architecture.md` as the default reference. This provides the broadest architectural context when the work domain is unclear.

### 3. Mode-Dependent Caps

The lens agent operates in three modes. The calling skill must respect these caps when selecting references:

- **guide mode:** Maximum 3–4 reference files. Select the highest-scoring matches.
- **review mode:** Maximum 3–4 reference files. Select the highest-scoring matches.
- **assess mode:** Uncapped — delta analysis needs broad coverage.

### 4. Signal Strength Prioritisation

When the number of matched references exceeds the mode cap, prioritise by signal strength:

1. Count keyword matches per reference file across the scanned source/context.
2. Rank reference files by match count (highest first).
3. Select the top 3–4 reference files by rank.

### 5. Responsibility Boundary

The **calling skill** determines which references to load. It reads this file, performs keyword scanning, applies mode caps, and passes the selected reference file paths to the lens agent.

The **lens agent** receives reference files as input and never selects its own references. This separation ensures the lens agent's context contains only what the calling skill deemed relevant.

## Example Usage

A skill preparing to invoke the lens agent in **review mode** on a file containing Fastify route handlers with JWT authentication:

1. **Scan source** — keywords found: `Fastify`, `routes`, `API`, `auth`, `JWT`, `middleware`
2. **Match signals** — `web-and-api-patterns.md` (3 hits: Fastify, routes, API), `security.md` (3 hits: auth, JWT, middleware)
3. **Apply mode cap** — review mode allows 3–4 files; 2 matched, both within cap
4. **Select references** — pass `web-and-api-patterns.md` and `security.md` to the lens agent

If the same file also imported a database pool (`pool`, `pg`), `data-patterns.md` would also match (2 hits), bringing the total to 3 reference files — still within the review mode cap.
