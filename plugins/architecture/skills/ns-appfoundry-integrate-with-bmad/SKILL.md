---
name: ns-appfoundry-integrate-with-bmad
description: "Wire the Netsurit AppFoundry architecture standard into BMAD workflows. Run this skill when a developer wants to integrate the plugin with BMAD, says 'integrate with BMAD', 'wire architecture into BMAD', 'connect plugin to BMAD', 'BMAD integration', 'set up BMAD integration', or invokes /ns-appfoundry-integrate-with-bmad. This skill creates an architect memory sidecar, generates project-specific context rules, and verifies code review integration — three file operations that make the architecture standard visible to BMAD workflows without modifying BMAD core."
---

# BMAD Integration

Wire the Netsurit AppFoundry architecture standard into BMAD workflows through three concrete file operations. This skill creates configuration files that BMAD agents and workflows read automatically — it never modifies BMAD core files.

The three actions:
1. **Architect Memory Sidecar** — biases the architect agent toward the standard as a golden path during `create-architecture` workflows
2. **Project-Specific Context Rules** — generates a concise section in `project-context.md` reflecting actual project decisions, loaded automatically by dev-story and code-review workflows
3. **Code Review Verification** — confirms that the BMAD code review workflow will pick up the project's `architecture.md`

This skill **requires** BMAD to be installed. All other plugin skills function without BMAD — this skill's purpose is specifically BMAD integration.

## When to Run

- After installing the plugin — set up the BMAD integration touchpoints
- After updating the plugin — re-run to refresh sidecar content with the latest standard version
- After changing `architecture.md` — re-run to update the project-specific context rules
- After registering new deviations — re-run to incorporate them into the context rules

## How This Skill Works

When invoked, follow these steps in order.

### Step 1: BMAD Detection & Extension Point Discovery

Determine the project root directory. Look for signals: `package.json`, `CLAUDE.md`, `.git/`, `pnpm-workspace.yaml`, or an `apps/` directory.

Scan the project for BMAD installation and available extension points:

1. **BMAD root** — check if `_bmad/` directory exists. If not found, report that BMAD is not installed and halt:
   > "BMAD is not installed in this project. The `_bmad/` directory was not found. This skill requires BMAD to function — it wires the architecture standard into BMAD workflows. To install BMAD, follow the BMAD installation instructions, then re-run this command."

2. **Memory sidecar support** — check if `_bmad/_memory/` directory exists. Note whether the memory module is available. If `_bmad/_memory/` does not exist, report that the memory module is not available and Action 1 (architect sidecar) will be skipped.

3. **BMM config** — check if `_bmad/bmm/config.yaml` exists. If found, read it and extract the `planning_artifacts` path and the BMAD version from the file header comment (e.g., `# Version: 6.0.4`). Note: the config uses `{project-root}` variable references (e.g., `"{project-root}/_bmad-output/planning-artifacts"`) — substitute the actual project root path when resolving these values. If `_bmad/bmm/config.yaml` is not found, report that BMM config is missing — `planning_artifacts` path cannot be resolved, so Step 2 will fall back to scanning project root and `docs/` only, and Action 3 (code review verification) will be limited since `{planning_artifacts}` glob patterns cannot be fully resolved.

4. **Code review workflow** — check if `_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml` exists. Note whether code review verification (Action 3) is possible.

5. **Project-context workflow** — check if `_bmad/bmm/workflows/generate-project-context/` directory exists. Note its presence for informational purposes.

Report discovered extension points:
```
BMAD Extension Points:
- BMAD root: Found
- BMAD version: {version from config header | Unknown}
- Memory sidecars: {Supported | Not available}
- BMM config: {Found (planning_artifacts: {path}) | Not found — Actions 2-3 limited}
- Code review workflow: {Found | Not found}
- Project-context workflow: {Found | Not found}
```

### Step 2: Architecture & Deviation Discovery

Locate the project's architecture document and deviation registry.

1. **Architecture doc** — look for `architecture.md` using the `planning_artifacts` path resolved from `_bmad/bmm/config.yaml` (Step 1). Also check project root and `docs/`. If found, read it completely and note the path. If not found:
   > "No architecture.md found — run BMAD `create-architecture` first or create one manually. Action 1 (architect sidecar) can still proceed. Actions 2 and 3 will be limited without an architecture document."

2. **Deviation registry** — look for `docs/architecture-deviations.md`. If found, read it completely and count active entries. If not found, note its absence.

3. **Plugin version** — read `plugins/architecture/.claude-plugin/plugin.json` and extract the version number for use in generated content.

Report what was found:
```
Project Context:
- Architecture doc: {Found at path | Not found}
- Deviation registry: {Found (N active entries) | Not found}
- Plugin version: {version}
```

### Step 3: Action 1 — Architect Memory Sidecar

Create a memory sidecar that instructs the architect agent to use the Netsurit AppFoundry architecture standard as a golden path bias.

**Prerequisite:** Memory sidecar support detected in Step 1. If `_bmad/_memory/` does not exist, skip this action and report why.

1. Create directory `_bmad/_memory/architect-sidecar/` if it does not exist.

2. Write `_bmad/_memory/architect-sidecar/architecture-standard.md` with the following content. Overwrite if the file already exists (idempotent).

The sidecar content must be self-contained — the architect agent will not have access to plugin reference files during its workflow. Include:

- A brief introduction explaining that the Netsurit AppFoundry architecture standard provides a golden path for Azure single-tenant business applications
- Condensed pattern summaries per domain (2-3 sentences each):
  - **Data layer** — centralised connection pool helper, parameterised queries, schema directory for migrations
  - **Auth** — Entra ID OIDC as default, JWT validation middleware on every protected route, RBAC pattern
  - **Deployment** — Azure Container Apps with Bicep IaC, multi-stage Dockerfiles, GitHub Actions CI/CD
  - **Observability** — dedicated health and readiness endpoints, structured logging, OpenTelemetry traces
  - **Testing** — unit tests for business logic, integration tests for API routes, E2E for critical flows
  - **Repo structure** — pnpm monorepo with apps/packages split, shared tsconfig, CLAUDE.md for AI context
- An informational pointer to `plugins/architecture/skills/architecture-skill/references/signal-mapping.md` for domain-specific deep dives. Note: this is a reference for human developers or agents with the plugin loaded — the architect agent may not have access to plugin files during its workflow, so the sidecar's domain summaries above must be self-sufficient
- Guidance on registering deviations in `docs/architecture-deviations.md` (DEV-NNN format) when departing from the standard
- The plugin version used to generate this sidecar

**Tone:** Guidance, not constraint. Use language like "The standard recommends...", "Teams typically...", "Consider...". Never "You MUST..." or "Required to...".

Report the action result:
> "Action 1: Created architect memory sidecar at `_bmad/_memory/architect-sidecar/architecture-standard.md`"

### Step 4: Action 2 — Project-Specific Context Rules

Generate a concise section in `project-context.md` reflecting the project's actual architecture decisions.

**Prerequisite:** `architecture.md` found in Step 2. If not found, skip this action and report:
> "Action 2: Skipped — no architecture.md found. Project-specific context rules require an architecture document to extract actual project decisions."

1. Read `architecture.md` content and extract actual project decisions: stack choices, auth approach, data layer, infrastructure patterns.

2. Read deviation registry content (if found in Step 2) and extract active deviations with their rationale.

3. Generate a concise section (~200-300 words) with this structure:

```markdown
## Architecture Standard (auto-generated by ns-appfoundry plugin)

This project follows the Netsurit AppFoundry architecture standard (v{plugin_version}).

**Stack:** {extracted from architecture.md — e.g., "Next.js + Fastify monorepo on Azure Container Apps"}
**Auth:** {extracted — e.g., "Entra ID OIDC" or "SAML via client IdP (DEV-001)"}
**Data:** {extracted — e.g., "Azure SQL via connection pool helper"}
**Infra:** {extracted — e.g., "Bicep templates, GitHub Actions CI/CD"}

**Key patterns to follow:**
- {3-5 bullet points of project-specific patterns from architecture.md}

**Registered deviations:**
- {List active deviations from registry with brief rationale, or "None registered"}

For detailed pattern guidance, see the architecture standard reference files via `/ns-appfoundry-code-review` or `/ns-appfoundry-onboard`.
```

**Critical:** Content must reflect **actual project decisions**, not the generic standard. If the project uses SAML instead of Entra ID, write "Auth uses SAML via client IdP" — not "Auth MUST use Entra ID."

4. Write to `project-context.md` using these rules:
   - **First run, file does not exist:** Create `project-context.md` with just the auto-generated section.
   - **First run, file exists but has no auto-generated section:** Append the section at the end of the file.
   - **Re-run, auto-generated section already exists:** Replace the existing section in place — find the content between the `## Architecture Standard (auto-generated by ns-appfoundry plugin)` header and the next `##` header (or EOF), and replace it with the new content. This ensures idempotent re-runs without duplicating sections.

Report the action result:
> "Action 2: {Created | Updated} project-specific context rules in `project-context.md` ({word_count} words)"

### Step 5: Action 3 — Code Review Verification

Verify that the BMAD code review workflow will pick up the project's `architecture.md`.

**Prerequisite:** Code review workflow found in Step 1. If not found, skip this action and report:
> "Action 3: Skipped — BMAD code review workflow not found at expected path."

1. Read `_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml`.

2. Check for `input_file_patterns.architecture` in the workflow configuration.

3. Extract the `whole` and `sharded` glob patterns from the architecture input pattern.

4. Verify that the project's `architecture.md` path (found in Step 2) matches at least one of these patterns. Resolve `{planning_artifacts}` in the glob patterns using the value from `_bmad/bmm/config.yaml`.

5. Report the result:
   - **Match found:**
     > "Action 3: Code review will pick up architecture.md at `{path}` — matched pattern `{pattern}`"
   - **No match:**
     > "Action 3: architecture.md at `{path}` may not be picked up by code review patterns. Consider moving it to `{planning_artifacts}` so the pattern `{whole_pattern}` matches."
   - **No architecture.md found:**
     > "Action 3: No architecture.md found — code review will not have architecture context until one is created. Run BMAD `create-architecture` or create one manually."

### Step 6: Completion Report

Summarise all three actions and their outcomes:

```
## BMAD Integration Complete

**Plugin version:** {version}
**Date:** {YYYY-MM-DD}

### Actions Performed

| Action | Status | Detail |
|--------|--------|--------|
| 1. Architect Memory Sidecar | {Done | Skipped} | {path or reason skipped} |
| 2. Project-Specific Context Rules | {Done | Skipped} | {path and word count, or reason skipped} |
| 3. Code Review Verification | {Done | Skipped} | {match result or reason skipped} |

### What Happens Next

- The architect agent will reference the standard as a golden path bias during `create-architecture` workflows
- Dev-story and code-review workflows will automatically load the project-specific context rules from `project-context.md`
- The code review workflow will load `architecture.md` for architectural context during reviews

This integration is idempotent — safe to re-run after standard updates or architecture changes.
```

## Files Read

- **`_bmad/bmm/config.yaml`** — BMM module config to resolve `planning_artifacts` path
- **`_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml`** — code review workflow to verify `input_file_patterns.architecture`
- **`plugins/architecture/.claude-plugin/plugin.json`** — plugin version for generated content
- **`architecture.md`** — project's architecture document (from `planning_artifacts` path, if exists)
- **`docs/architecture-deviations.md`** — deviation registry in the project (if exists)
- **`project-context.md`** — checked for existing auto-generated section before writing (if exists)

## Files Written

- **`_bmad/_memory/architect-sidecar/architecture-standard.md`** — architect memory sidecar with golden path bias guidance (Action 1). Created or overwritten.
- **`project-context.md`** — project-specific architecture context rules section appended or replaced (Action 2). Created if absent, section replaced if re-running.

## Output Format

This skill produces two categories of output:

**Console output (displayed to user during execution):**
- Extension point discovery report (Step 1) — table of BMAD components found/not found, including BMAD version
- Project context report (Step 2) — architecture doc, deviation registry, and plugin version status
- Per-action result messages (Steps 3-5) — status line for each action with path or skip reason
- Completion report (Step 6) — summary table of all actions with status, detail, and next steps

**Generated files (written to consumer project):**
- `_bmad/_memory/architect-sidecar/architecture-standard.md` — markdown sidecar loaded by the architect agent
- `project-context.md` — auto-generated section appended or replaced in the project's context file

## What This Skill Does Not Do

- **Modify BMAD core files** — this skill writes configuration files that BMAD reads; it never changes BMAD agent definitions, workflows, or templates
- **Replace the architecture standard** — the sidecar provides guidance bias, not a rewrite of the standard
- **Run without BMAD** — unlike all other plugin skills, this one requires BMAD to be installed
- **Spawn subagents** — all three actions are performed directly in the current session
- **Embed reference file content** — the sidecar references domains by name and points to signal-mapping.md, following NFR7
- **Modify the code review workflow** — Action 3 only verifies that existing patterns will match; it never changes workflow configuration
