---
name: ns-appfoundry-delta-analysis
description: "Run delta analysis to assess a project's alignment with the architecture standard and generate a shareable HTML report. Use this skill when an architect wants to evaluate a brownfield project, generate an alignment assessment, check for architectural drift, create an HTML delta report, or prepare for a review board meeting. Trigger on: 'run delta analysis', 'assess alignment', 'architecture assessment', 'generate delta report', 'create HTML report', 'alignment check', 'project health assessment', or /ns-appfoundry-delta-analysis. This skill analyses source code against the architecture standard at configurable depth — quick scan, standard review, or deep audit — classifies deviations as intentional or unintentional, and generates a standalone HTML report for standard and deep depths."
---

# Delta Analysis

Assess an existing project's alignment with the Netsurit AppFoundry architecture standard. This skill evaluates source code, configuration, and infrastructure files against reference patterns, classifies deviations as intentional (registered) or unintentional (drift), and produces a structured assessment across six categories.

Three depth levels are available:
- **Quick scan** — fast file-system checks, no lens agent, summary only
- **Standard review** — lens agent analysis with signal-mapped references, full findings
- **Deep audit** — lens agent analysis with all reference files, comprehensive findings with refactoring recommendations

This skill functions without BMAD installed.

## When to Run

- Before a review board meeting — generate a comprehensive alignment assessment
- Periodic project health check — identify drift before it accumulates
- After onboarding to a brownfield project — understand alignment at a glance
- After major refactoring — verify structural integrity against the standard

## How This Skill Works

When invoked, follow these steps in order.

### Step 1: Initialisation

Determine the project root directory. Look for signals: `package.json`, `CLAUDE.md`, `.git/`, `pnpm-workspace.yaml`, or an `apps/` directory.

Check for project context:

1. **Architecture doc** — look for `architecture.md` in the project (common locations: project root, `docs/`). If found, note it for context. If not found, inform the user:
   > "No project-specific architecture.md found. Analysis will compare source code directly against the standard — findings may be less precise without project-specific architectural decisions."

2. **Deviation registry** — look for `docs/architecture-deviations.md`. If found, read it and count active entries. If not found, note its absence (all deviations will be classified as Unregistered).

Report context availability:
```
Context check:
- Architecture doc: {Found at path | Not found — reduced accuracy}
- Deviation registry: {Found (N active entries) | Not found — all deviations will be Unregistered}
```

### Step 2: Depth Selection

Present the depth menu using AskUserQuestion:

```
What depth of analysis would you like?

[1] Quick scan — fast structural checks across 6 categories, no deep pattern analysis. Best for: rapid pulse check, mid-sprint verification.

[2] Standard review (recommended) — spawns the Architecture Lens agent with signal-matched references for detailed pattern analysis. Produces full findings with deviation classification. Best for: regular alignment assessments, pre-review preparation.

[3] Deep audit — spawns the Architecture Lens agent with ALL reference files for comprehensive coverage. Produces detailed findings with refactoring recommendations and impact assessments. Best for: initial brownfield assessment, review board preparation, major milestone reviews.
```

Wait for the user's selection before proceeding.

### Step 3: Source Discovery

Scan the project for files to analyse. Collect:

- **Source files** — `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.jsx` in application directories
- **Config files** — `package.json`, `tsconfig*.json`, `pnpm-workspace.yaml`, `.env*` (not contents, just presence)
- **Infrastructure files** — `**/Dockerfile*`, `**/*.bicep`, `.github/workflows/*.yml`

Exclude non-project directories:
- `node_modules/`
- `.claude/`
- `_bmad/`
- `_bmad-output/`
- `.git/`
- `dist/`
- `build/`
- `coverage/`

Report the file count:
> "Found {N} files to analyse across source, config, and infrastructure."

### Step 4: Quick Scan Path

**Only if depth = quick.** Perform direct file-system checks without spawning any agent.

Run checks across the six categories using Glob, Grep, and Read tools:

**1. Data Layer**
- Check for centralised pool helper (`**/pool.ts`, `**/db.ts`, `**/database.ts`)
- Check for raw `pg.query()` calls outside pool helper
- Check for schema directory (`schema/`)
- Conditional: only if database signals found (`pg` in package.json, `DATABASE_URL` references)

**2. Auth**
- Check for auth middleware (`**/auth-middleware*`, `**/auth.ts`, `**/middleware/auth*`)
- Check for token verification signals (`verify`, `jwt`, `token`, `Bearer`, `preHandler`)
- Check for Entra ID signals (`entra`, `msal`, `azure-ad`)
- Conditional: only if backend API signals found

**3. Infrastructure**
- Check for Dockerfiles and multi-stage builds (count `FROM` statements)
- Check for Bicep templates (`infra/`, `**/*.bicep`)
- Check for CI/CD (`.github/workflows/`)

**4. Observability**
- Check for health endpoints (`**/health*.ts`, `/api/health`, `/api/ready`)
- Check for readiness endpoints
- Check for logging/telemetry setup

**5. Testing**
- Check for test files (`**/*.test.ts`, `**/*.spec.ts`)
- Check for test configuration (`jest.config*`, `vitest.config*`)
- Check for test directories (`__tests__/`, `tests/`)

**6. Repo Structure**
- Check for standard directories (`apps/`, `packages/`, `infra/`, `schema/`)
- Check for top-level files (`CLAUDE.md`, `README.md`, `pnpm-workspace.yaml`, `tsconfig.base.json`)

For each check, assign a severity level using the shared vocabulary (1 = pattern opportunity, 2 = drift, 3 = significant deviation, 4 = critical deviation). Then compute the alignment rating per category using the same thresholds as the delta analysis agent:
- **Aligned** — no findings at severity 2 or higher in this category
- **Partially Aligned** — findings at severity 2 (drift) but nothing at severity 3 or higher
- **Divergent** — findings at severity 3 or higher (significant or critical deviation)

Severity 1 (pattern opportunity) findings do not affect the alignment rating.

Cross-reference findings against the deviation registry (if found in Step 1). For each finding, attempt to match against active registry entries by pattern domain:
- Map the finding's category to the registry entry's `Pattern` field (`{reference-domain} / {concern}`)
- Example: a "Data Layer" finding about missing pool helper would match a registry entry with Pattern `data-patterns / connection-pool-helper`
- If a match is found, convert the finding to a positive acknowledgment: "Registered deviation (DEV-NNN): [rationale from registry]"
- If no match is found, classify as Unregistered

Go to **Step 6** (skip Step 5).

### Step 5: Standard/Deep Analysis Path

**Only if depth = standard or deep.**

**5a: Reference Selection**

Read `plugins/architecture/skills/architecture-skill/references/signal-mapping.md`.

- **Standard review:** Scan collected source files for keyword signals. Apply signal mapping rules (case-insensitive, whole-word, phrase matching). Select all matched references — no cap for assess mode. If no signals match, load `architecture.md` as fallback.

- **Deep audit:** Load ALL 10 reference files from `plugins/architecture/skills/architecture-skill/references/`, bypassing signal mapping entirely:
  - `architecture.md`
  - `data-patterns.md`
  - `security.md`
  - `deployment.md`
  - `observability.md`
  - `web-and-api-patterns.md`
  - `testing.md`
  - `local-development.md`
  - `repo-standards.md`
  - `decision-framework.md`

Report selected references:
> "Selected {N} reference files for analysis: {list}"

**5b: Spawn Delta Analysis Agent**

Spawn the delta analysis agent as a subagent via the Task tool with `subagent_type: "general-purpose"` and a prompt that includes:

1. Instruct the agent to read the delta analysis agent definition: `plugins/architecture/agents/ns-appfoundry-delta-analysis.md`
2. Provide input contract parameters:
   - `depth`: `standard` or `deep`
   - `source_files`: the file paths collected in Step 3
   - `reference_files`: the reference file paths selected in Step 5a (full paths under `plugins/architecture/skills/architecture-skill/references/`)
   - `deviation_registry_path`: path to `docs/architecture-deviations.md` if found in Step 1
   - `project_scope`: project name and any context from architecture doc
   - `standard_version`: version from `plugins/architecture/.claude-plugin/plugin.json` (read it before spawning the agent)
3. Instruct the agent to:
   - Read the delta analysis agent definition first
   - Follow its behaviour for the specified depth
   - Spawn the Architecture Lens agent in assess mode as described in the agent definition
   - Return the complete structured assessment (category alignment + deviation table + metadata)

The Task tool provides context isolation — all reference and source files load into the subagent chain's context only.

### Step 6: Results Assembly

Process the assessment data into the structured output format:

**From quick scan (Step 4):** Assemble direct check results into:
- Category alignment overview (6 categories with ratings)
- Finding list (if any issues detected)
- Metadata (depth: quick, date, standard version from `plugins/architecture/.claude-plugin/plugin.json`, project name)

**From standard/deep analysis (Step 5):** The delta analysis agent returns the complete structured assessment. Parse and prepare for presentation.

The structured assessment data is presented inline first. For standard and deep depths, the HTML report is generated automatically in Step 8.

### Step 7: Inline Results

Present findings inline in the conversation.

**Summary dashboard:**
```
## Delta Analysis Results

**Project:** {project name}
**Depth:** {quick | standard | deep}
**Date:** {YYYY-MM-DD}
**Standard Version:** {version}

### Category Alignment

| Category | Rating |
|----------|--------|
| Data Layer | {Aligned | Partially Aligned | Divergent} |
| Auth | {rating} |
| Infrastructure | {rating} |
| Observability | {rating} |
| Testing | {rating} |
| Repo Structure | {rating} |

### Summary

- Pattern opportunities: {count}
- Drift: {count}
- Significant deviations: {count}
- Critical deviations: {count}
- Registered deviations: {count}
```

**Key findings:** Display all findings using the structured format from the agent's output contract. Group by severity (critical first, then significant, drift, pattern opportunities).

If zero findings:
> "No findings — this project is well-aligned with the architecture standard. Nice work!"

**Footer note (standard/deep):**
> "A shareable HTML report will be generated next."

**Footer note (quick scan):**
> "For a shareable HTML report, re-run at standard or deep depth."

### Step 8: HTML Report Generation

**Only execute for standard and deep depths.** Quick scans skip this step — inline results are sufficient for informal pulse checks.

Construct the `REPORT_DATA` JSON object from the structured assessment data (the same data used for inline results in Step 7). The JSON schema:

```json
{
  "meta": {
    "projectName": "string",
    "date": "YYYY-MM-DD",
    "depth": "standard | deep",
    "standardVersion": "string",
    "deviationRegistry": "Found (N active entries) | Not found",
    "architectureDoc": "Found | Not found"
  },
  "categoryAlignment": [
    { "category": "string", "rating": "Aligned | Partially Aligned | Divergent", "summary": "string" }
  ],
  "findingsSummary": {
    "patternOpportunities": 0, "drift": 0, "significantDeviations": 0,
    "criticalDeviations": 0, "registeredDeviations": 0
  },
  "findings": [
    {
      "severity": 1-4,
      "severityLabel": "string",
      "category": "string",
      "pattern": "string",
      "location": "file:line or description",
      "observation": "string",
      "recommendation": "string",
      "reference": "{domain}.md § {section}",
      "registry": "Registered (DEV-NNN) | Unregistered",
      "rationale": "string or null",
      "refactoringImpact": "string or null"
    }
  ]
}
```

Perform these operations:

1. Construct the `REPORT_DATA` JSON object from the structured assessment data
2. Read the template file from **plugin path**: `plugins/architecture/templates/delta-report.html`
3. Create the `reports/` directory in the **consumer project** if absent (`mkdir -p {project-root}/reports/`)
4. Write `{project-root}/reports/delta-analysis-{YYYY-MM-DD}.html` by prepending `<script>window.REPORT_DATA = ${JSON.stringify(data, null, 2)};</script>\n` before the template content
5. Report the file path and suggest gitignore:
   > "HTML report generated: `reports/delta-analysis-{YYYY-MM-DD}.html`. Open in any browser to view. This file is self-contained and can be shared via Teams or email. Tip: Consider adding `reports/` to your `.gitignore` — delta analysis reports are generated artifacts."

**Path convention:** Template read from plugin (`plugins/architecture/templates/delta-report.html`). Report written to consumer project (`{project-root}/reports/delta-analysis-{YYYY-MM-DD}.html`). Date format: ISO 8601 with hyphens (e.g., `2026-03-13`).

## Files Read

- **Project source, config, and infrastructure files** — as discovered in Step 3
- **`docs/architecture-deviations.md`** — deviation registry in the consumer project (if exists)
- **`plugins/architecture/skills/architecture-skill/references/signal-mapping.md`** — keyword-to-reference mapping (standard/deep only)
- **`plugins/architecture/agents/ns-appfoundry-delta-analysis.md`** — agent definition loaded by subagent (standard/deep only)
- **`plugins/architecture/agents/ns-appfoundry-lens.md`** — lens agent definition loaded by nested subagent (standard/deep only)
- **Selected reference files** — from `plugins/architecture/skills/architecture-skill/references/` (standard: signal-mapped uncapped; deep: all 10)
- **`plugins/architecture/.claude-plugin/plugin.json`** — standard version for metadata
- **`plugins/architecture/templates/delta-report.html`** — HTML report template (standard/deep only)

This skill writes HTML report files to `{project-root}/reports/` for standard and deep depths. It does not modify any project source files.

## What This Skill Does Not Do

- **Generate HTML reports for quick scans** — use standard or deep depth for shareable reports
- **Modify project source files** — it writes HTML reports to `{project-root}/reports/` but never touches source code
- **Require BMAD** — this skill works in any project, whether or not BMAD is installed
- **Fix deviations** — use `/ns-appfoundry-scaffold` to generate aligned scaffolding for new components
