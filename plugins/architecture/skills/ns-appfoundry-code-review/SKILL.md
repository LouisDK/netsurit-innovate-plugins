---
name: ns-appfoundry-code-review
description: "Deep architecture code review for Azure single-tenant applications. Run this skill when a developer asks for a thorough code review against the architecture standard, wants deep pattern analysis of their code, says 'review my code against the standard', 'architecture code review', 'deep code review', 'pattern analysis', 'review my changes', or invokes /ns-appfoundry-code-review. This skill spawns the Architecture Lens subagent for in-depth pattern comparison — unlike the quick structural check, it reads source code and analyses patterns against reference files."
---

# Architecture Code Review

A deep code review that analyses source code against the Netsurit Azure application standard. This skill selects the review scope, identifies which reference patterns are relevant, and spawns the Architecture Lens agent to perform detailed pattern analysis.

This skill is the primary consumer of the Architecture Lens agent in review mode. Where `/ns-appfoundry-check` does a fast structural scan using direct file-system tools, this skill provides deeper analysis by loading reference patterns into an isolated subagent context and comparing source code against them.

## Philosophy

This skill follows the "helpful colleague, not compliance gate" approach. Findings are constructive observations with concrete recommendations — never judgment. The words "violation," "non-compliant," and "failed" are never used. Every finding explains why the pattern exists, not just that it differs from the standard.

## When to Run

- Before merging a feature branch — use **Story scope** or **Git changes** to review what's changed
- Periodic project health check — use **Full project** for a broad sweep
- After a fix cycle — use **Git changes** for the fastest feedback loop on dirty files
- Focused review — use **Custom** scope for specific files or directories

## How This Skill Works

When invoked, follow these steps in order.

### Step 1: Scope Selection

Present the developer with scope options:

```
What would you like to review?

[1] Story scope — files from current/most recent story
[2] Full project — all application source files
[3] Git changes — only uncommitted/dirty files (fastest feedback loop)
[4] Custom — specify files or directories
```

Use the AskUserQuestion tool to present these four options. Wait for the developer's selection before proceeding.

### Step 2: Source File Collection

Collect source files based on the selected scope.

**Option 1 — Story scope:**
1. Find the most recent story file in `_bmad-output/implementation-artifacts/`. Look for the story with the highest epic-story number that has status `done` or `in-progress`.
2. Extract the File List section from that story file.
3. Also run `git diff --name-only` to catch uncommitted changes related to the story.
4. Combine both lists, deduplicate.
5. If no story file is found, inform the developer and ask them to provide file paths instead (fall back to custom scope).

**Option 2 — Full project:**
1. Scan for application source files using Glob patterns: `apps/**/*.ts`, `apps/**/*.tsx`, `apps/**/*.js`, `apps/**/*.jsx`, `packages/**/*.ts`, `packages/**/*.tsx`, `src/**/*.ts`, `src/**/*.tsx`, and equivalent patterns for the project's source directories.
2. Exclude non-application paths: `_bmad/`, `_bmad-output/`, `.claude/`, `node_modules/`, `.git/`, `dist/`, `build/`, `coverage/`.
3. Exclude non-source files: `*.md` (except `CLAUDE.md`), `*.yaml`, `*.lock`.
4. Include `package.json` files only when needed for signal scanning.

**Option 3 — Git changes:**
1. Run `git diff --name-only` to get unstaged changes.
2. Run `git diff --cached --name-only` to get staged changes.
3. Combine both lists, deduplicate.
4. Filter to application source files using the same exclusion rules as full project scope.
5. If no changed files remain after filtering, inform the developer and suggest a different scope.

**Option 4 — Custom:**
1. Ask the developer to specify file paths or glob patterns.
2. Resolve globs using the Glob tool.
3. Validate that the specified files exist.

After collection, confirm the file count to the developer:
> "Found {N} source files to review. Scanning for relevant reference patterns..."

### Step 3: Smart Reference Loading

Select which reference files to pass to the lens agent based on keyword signals in the source files.

1. Read `plugins/architecture/skills/architecture-skill/references/signal-mapping.md`.
2. Scan the collected source files for keyword signals from the signal mapping table. Also scan `package.json` files in the project for dependency names (e.g., `pg`, `fastify`, `next`) — these are strong keyword signals even though `package.json` is not passed to the lens agent as a source file.
3. Apply matching rules:
   - Case-insensitive matching
   - Whole-word matching (`pg` matches `pg` but not `page`)
   - Multi-word entries are phrase matches (`integration test` requires both words adjacent)
   - Each keyword is independent (`CI/CD` is a single signal)
   - Overlapping signals resolve by specificity (`container apps` as phrase → `architecture.md` over bare `container` → `deployment.md`)
4. Count keyword hits per reference file.
5. Rank reference files by hit count (highest first).
6. Select the top 3-4 reference files (review mode cap).
7. If no keywords match any signal group, load `architecture.md` as the default fallback.

Report the selected references to the developer:
> "Selected references based on signal analysis: {list of reference files}"

### Step 4: Lens Agent Invocation

Before invocation, validate inputs:
- Confirm `source_files` resolves to at least one existing file. If empty (e.g., all files were filtered out), inform the developer and suggest a different scope instead of invoking with no files.
- Confirm `reference_files` is non-empty. If signal scanning matched nothing, the fallback to `architecture.md` from Step 3 should ensure this — but verify the fallback was applied.

Spawn the Architecture Lens agent as a subagent via the Task tool.

Use the Task tool with `subagent_type: "general-purpose"` and a prompt that includes:

1. **Instruct the agent to read the lens agent definition:**
   `plugins/architecture/agents/ns-appfoundry-lens.md`

2. **Provide the input contract parameters:**
   - `mode`: `review`
   - `reference_files`: the list of reference file paths selected in Step 3 (full paths under `plugins/architecture/skills/architecture-skill/references/`)
   - `source_files`: the list of source file paths collected in Step 2
   - `context`: a description of the review scope (e.g., "Story 3.2 files", "Full project scan", "Git uncommitted changes", or the user's custom description)

3. **Instruct the agent to:**
   - Read the lens agent definition file first
   - Read all provided reference files
   - Read all provided source files
   - Follow the review mode behaviour as defined in the lens agent
   - Return the structured findings output as defined in the lens agent's output contract

The Task tool provides context isolation — reference files load into the subagent's context only. The parent conversation receives only the structured findings output.

### Step 5: Present Results

Receive the structured findings from the lens agent and present them inline in the conversation.

The findings format from the lens agent is already human-readable — display it directly without transformation. The output includes:

- **Findings Summary** — counts by severity level (pattern opportunities, drift, significant deviations, critical deviations)
- **Individual Findings** — each with severity, category, pattern, location, observation, recommendation, and reference

If the lens agent returns zero findings, congratulate the developer:
> "No findings — your code is well-aligned with the architecture standard. Nice work!"

If findings are returned, follow them with a brief contextual note:
> "Review complete. {total_count} findings across {file_count} files. Use these as conversation starters — each finding links to a reference section for the full pattern detail."

## Output Format

This skill displays the lens agent's structured findings output directly — no transformation needed. The output format is defined in the lens agent's output contract:

```
## Findings Summary

- Pattern opportunities: {count}
- Drift: {count}
- Significant deviations: {count}
- Critical deviations: {count}

## Findings

### [{severity}] {category} — {pattern}
**Location:** {file:line}
**Finding:** {observation}
**Recommendation:** {what to do}
**Reference:** {reference-domain}.md § {section-name}
**Registry:** N/A
```

The **Registry** field is always `N/A` in review mode. Deviation classification is an assess-mode concern.

If zero findings are returned, display a congratulatory message instead.

This skill writes nothing — output is inline in the conversation only.

## Files Read

- **Source files** — as determined by scope selection (Step 2)
- **`plugins/architecture/skills/architecture-skill/references/signal-mapping.md`** — keyword-to-reference mapping for smart loading
- **`plugins/architecture/agents/ns-appfoundry-lens.md`** — agent definition loaded by the subagent
- **Selected reference files** — 3-4 files from `plugins/architecture/skills/architecture-skill/references/` loaded by the subagent based on signal analysis

This skill writes nothing — it is read-only.

## References

Loaded on-demand by the lens agent subagent (not by this skill directly):

| Reference | Loaded when signals match... |
|---|---|
| `references/architecture.md` | architecture, topology, container apps, system shape |
| `references/data-patterns.md` | SQL, queries, migrations, pool, pg, database, schema |
| `references/security.md` | auth, JWT, middleware, Entra, login, RBAC, roles |
| `references/deployment.md` | Dockerfile, container, Bicep, deploy, CI/CD, GitHub Actions |
| `references/observability.md` | health, logging, telemetry, OpenTelemetry, monitor |
| `references/web-and-api-patterns.md` | Next.js, Fastify, routes, API, SSE, streaming, components |
| `references/testing.md` | test, jest, vitest, coverage, E2E, integration test |
| `references/local-development.md` | docker-compose, local dev, .env, dev environment |
| `references/repo-standards.md` | monorepo, pnpm, packages, repo structure, CLAUDE.md |
| `references/decision-framework.md` | exception, deviation, trade-off, alternative, decision |

## What This Skill Does Not Do

- **Direct file-system checks** — use `/ns-appfoundry-check` for fast structural scanning without the lens agent
- **Generate or modify files** — this skill is read-only, it analyses and reports
- **Require BMAD** — this skill works in any project, whether or not BMAD is installed
- **Select more than 3-4 references** — review mode caps reference loading to keep the lens agent focused
- **Classify deviations** — deviation registry classification is an assess-mode concern; review mode sets Registry to N/A
- **Replace standard code review** — this is architecture pattern analysis, complementary to functional code review
