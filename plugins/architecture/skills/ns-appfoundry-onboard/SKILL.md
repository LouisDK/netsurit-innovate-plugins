---
name: ns-appfoundry-onboard
description: "Conversational project onboarding walkthrough for developers joining a project. Run this skill when a developer wants to understand a project's architecture, says 'onboard me', 'walkthrough', 'explain this project', 'I'm new to this project', 'project onboarding', 'architecture walkthrough', 'show me around', 'help me understand this codebase', or invokes /ns-appfoundry-onboard. This skill loads project context and reference patterns, then runs the onboarding agent as an interactive conversation in the current session — not as an isolated subagent."
---

# Project Onboarding

A conversational walkthrough that helps developers new to a project understand its architecture, key decisions, and intentional deviations from the standard. The onboarding agent explains patterns in context, then stays available for follow-up questions.

This skill runs the onboarding agent **in the current session** as a multi-turn conversation. Unlike code review and delta analysis (which spawn isolated subagents), onboarding loads references directly into the conversation so the developer can ask natural follow-up questions with full context available.

This skill functions without BMAD installed.

## When to Run

- First day on a project — get oriented quickly with a guided walkthrough
- Returning to a project after time away — refresh your understanding
- After the team changes architecture — understand what changed and why
- Before your first contribution — know the patterns before writing code

## How This Skill Works

When invoked, follow these steps in order.

### Step 1: Context Discovery

Determine the project root directory. Look for signals: `package.json`, `CLAUDE.md`, `.git/`, `pnpm-workspace.yaml`, or an `apps/` directory.

Check for project context:

1. **Architecture doc** — look for `architecture.md` in common locations: project root, `docs/`. If found, read it completely. If not found, note its absence — the walkthrough will have reduced accuracy.

2. **Deviation registry** — look for `docs/architecture-deviations.md`. If found, read it completely and note the number of active entries. If not found, note its absence.

3. **Project structure** — scan the project directory layout using Glob. Note key directories (`apps/`, `packages/`, `src/`, `infra/`, `schema/`, `docs/`), key files (`package.json`, `CLAUDE.md`, `Dockerfile`, `*.bicep`), and the overall monorepo or single-package structure.

Report context availability to the developer:
```
Context check:
- Architecture doc: {Found at path | Not found — reduced accuracy}
- Deviation registry: {Found (N active entries) | Not found}
- Project structure: {Summary of key directories and files}
```

### Step 2: Smart Reference Selection

Select the 2-3 most relevant reference files to load based on the project's architecture decisions.

1. Read `plugins/architecture/skills/architecture-skill/references/signal-mapping.md`.

2. **If `architecture.md` was found:** Scan its content for keyword signals from the signal mapping table. The architecture document reveals which domains the project uses (e.g., mentions of Fastify, pg, Entra ID, Container Apps).

3. **If no `architecture.md`:** Scan source files for keyword signals instead. Look in `package.json` for dependency names, scan key source directories for import patterns and framework usage.

4. Apply matching rules from signal-mapping.md:
   - Case-insensitive matching
   - Whole-word matching (`pg` matches `pg` but not `page`)
   - Multi-word entries are phrase matches
   - Each keyword is independent (`CI/CD` is a single signal)
   - Overlapping signals resolve by specificity

5. Count keyword hits per reference file. Rank by hit count (highest first).

6. Select the top **2-3** reference files (onboarding mode cap — tighter than review's 3-4).

7. If no keywords match any signal group, load `architecture.md` as the default fallback reference.

8. Read the selected reference files completely.

Report selected references:
> "Selected references based on project signals: {list of reference files}"

### Step 3: Agent Handoff

Present all loaded context to the conversation and hand off to the onboarding agent.

**This step does NOT use the Task tool or Agent tool.** The onboarding agent runs inline in the current session.

1. Present all loaded context to the conversation using clearly labelled sections. Include the full content of each source under its heading:

   ```
   ## Architecture Document
   {Full content of architecture.md, or: "No architecture.md found — walkthrough based on source code analysis (reduced accuracy)."}

   ## Deviation Registry
   {Full content of docs/architecture-deviations.md, or: "No deviation registry found."}

   ## Reference: {Domain Name}
   {Full content of each selected reference file, one section per file}

   ## Project Structure
   {Directory layout summary, key files, monorepo/single-package structure}
   ```

2. Read the onboarding agent definition: `plugins/architecture/agents/ns-appfoundry-onboarding.md`

3. Follow the agent's Phase 1 (Initial Walkthrough) and Phase 2 (Domain Summaries) behaviour as defined in the agent definition. Deliver the walkthrough using the agent's tone rules and deviation framing conventions.

### Step 4: Interactive Q&A

After delivering the walkthrough, invite the developer to ask questions:

> "That's the overview! Feel free to ask about any area — architecture decisions, specific patterns, how something works, or anything else you're curious about. I'm here to help you get comfortable with this codebase."

During Q&A:
- Answer conversationally, drawing from the loaded context
- If a question touches a reference domain not yet loaded, read the relevant reference file from `plugins/architecture/skills/architecture-skill/references/` on demand and incorporate it into the answer
- If asked about a deviation, provide the full rationale from the registry entry
- Continue the conversation until the developer indicates they're done

## Files Read

- **`architecture.md`** — project's architecture document (project root or `docs/`, if exists)
- **`docs/architecture-deviations.md`** — deviation registry in the project (if exists)
- **`plugins/architecture/skills/architecture-skill/references/signal-mapping.md`** — keyword-to-reference mapping for smart selection
- **`plugins/architecture/agents/ns-appfoundry-onboarding.md`** — onboarding agent definition
- **2-3 selected reference files** — from `plugins/architecture/skills/architecture-skill/references/` based on signal analysis
- **Additional reference files** — loaded on demand during Q&A if the developer asks about an unloaded domain

This skill writes nothing — it is read-only.

## References

Available reference files loaded on-demand by the skill (initial selection) and agent (Q&A expansion):

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

## Output Format

Conversational walkthrough delivered inline in the current session. No files generated, no structured reports. Output follows the onboarding agent's conversational format:

1. Project overview and key decisions
2. Domain summaries for loaded reference areas
3. Interactive Q&A

## What This Skill Does Not Do

- **Produce structured findings** — use `/ns-appfoundry-code-review` for severity-rated findings against the standard
- **Generate reports** — use `/ns-appfoundry-delta-analysis` for HTML alignment reports
- **Modify project files** — this skill is completely read-only
- **Run as a subagent** — the onboarding agent runs in the current session for natural conversation, not via the Task tool
- **Load all references** — only 2-3 most relevant references are loaded initially, with on-demand expansion during Q&A
- **Require BMAD** — this skill works in any project, whether or not BMAD is installed
- **Assign severity ratings** — this is education, not assessment
