# Architecture Plugin

Opinionated architectural standard for building single-tenant business applications on Azure — embedded directly into your AI coding workflow as a Claude Code plugin.

**Version:** 0.1.0

## Overview

The Architecture Plugin transforms Netsurit's Azure application standard from passive documentation into active AI-integrated assistance. Instead of maintaining a wiki that LLMs cannot browse, the standard lives inside the AI workflow — the right patterns are present at the moment the AI makes implementation decisions.

The plugin targets three developer profiles whose adoption compounds:

- **Lead developers** scaffold consistent projects and review architecture alignment
- **Junior developers** absorb patterns by working within AI-guided guardrails
- **Architects** receive structured delta analysis reports for review board meetings

The design philosophy is "helpful colleague, not compliance gate." Standards are presented as best practices, not unbreakable rules. Intentional deviations are welcomed and documented; unintentional drift is caught and surfaced with context.

## Installation

### Marketplace (Recommended)

Add the Netsurit Innovate Plugins marketplace and enable the architecture plugin:

```bash
claude plugins:add github:louisdk/netsurit-innovate-plugins
```

Then enable the `architecture` plugin when prompted.

### Manual Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/louisdk/netsurit-innovate-plugins.git
   ```

2. Add the local path as a marketplace source:
   ```bash
   claude plugins:add /path/to/netsurit-innovate-plugins
   ```

3. Enable the `architecture` plugin.

The plugin is functional immediately — no build step, no external dependencies, no configuration required.

### Prerequisites

None. The plugin is pure markdown and runs entirely within Claude Code's plugin system. No runtime dependencies, no API keys, no external services.

### Updates

Plugin updates are distributed via the marketplace. When the marketplace repository is updated, you receive the new version automatically. No per-project maintenance is needed.

## Quick Start

After installing, the `architecture-skill` is immediately available. Ask Claude about architecture decisions and it will respond with guidance from the standard:

- "What database should I use?"
- "How should I structure my Fastify server?"
- "What's the standard deployment pattern?"
- "Help me set up a new Azure project"

The skill fires automatically when your questions match architecture topics — no slash command needed.

Once `/ns-appfoundry-check` is available (Planned), you can run a quick structural compliance scan of your project.

## Capabilities

| Capability | Description | Status |
|------------|-------------|--------|
| `architecture-skill` | The architecture standard knowledge base. Auto-fires on architecture questions — provides golden path guidance, reference file loading, and template asset awareness. No slash command needed. | Available |
| `/ns-appfoundry-check` | Quick standards compliance check. Scans your project's file system directly for structural alignment — repo layout, health endpoints, Dockerfiles, connection pools, auth middleware. Immediate, actionable feedback. | Planned |
| `/ns-appfoundry-code-review` | Deep pattern analysis via the Architecture Lens agent. Choose scope: story files, full project, git changes, or custom paths. Returns structured findings with severity ratings. | Planned |
| `/ns-appfoundry-scaffold` | Guided project generation. Reads your `architecture.md`, presents a scaffolding plan, detects deviations, generates server boilerplate, Bicep infrastructure, Docker configuration, and CI/CD — then verifies the project compiles. | Planned |
| `/ns-appfoundry-delta-analysis` | Brownfield assessment with tiered depth (quick scan, standard review, deep audit). Generates a standalone HTML report for review board meetings with alignment ratings and deviation classification. | Planned |
| `/ns-appfoundry-onboard` | Conversational project walkthrough for new developers. Explains architecture decisions, patterns, and intentional deviations interactively. | Planned |
| `/ns-appfoundry-integrate-with-bmad` | Wire the architecture standard into BMAD workflows — creates architect memory sidecar, generates project-context rules, and verifies code review integration. | Planned |

## Agents

Three internal agents will power the plugin's analysis capabilities. They are spawned by the capabilities above — you interact with the skill entry points, not the agents directly. All agents are **Planned** for future epics.

**Architecture Lens** (`agents/ns-appfoundry-lens.md` — Planned)
The core analysis engine with three modes:
- **Guide** — proactive implementation recommendations (forward-looking, no severity ratings)
- **Review** — code analysis against reference patterns with structured findings and severity ratings
- **Assess** — project alignment evaluation with deviation classification (registered vs. unregistered)

Will run as an isolated subagent — reference files load into the agent's context without consuming the parent conversation's context window.

**Delta Analysis** (`agents/ns-appfoundry-delta-analysis.md` — Planned)
Brownfield assessment agent that analyses source code, configuration, and infrastructure against the standard. Will produce structured findings cross-referenced with the deviation registry to distinguish intentional decisions from unintentional drift. Generates standalone HTML reports.

**Onboarding** (`agents/ns-appfoundry-onboarding.md` — Planned)
Conversational walkthrough agent that explains a project's architecture decisions and deviations. Will run in the current session (not as a subagent) so you can ask follow-up questions naturally.

## BMAD Integration

The plugin operates in two modes:

**Standalone** — All commands work independently, without BMAD installed. Use `/ns-appfoundry-check` and delta analysis for brownfield assessment, or `architecture-skill` for ad-hoc guidance.

**BMAD-Integrated** — Run `/ns-appfoundry-integrate-with-bmad` to wire the standard into BMAD workflows. This performs three actions:

1. **Architect Memory Sidecar** — Creates guidance for BMAD's architect agent to treat the standard as a golden path bias during `create-architecture` workflows
2. **Project-Context Rules** — Generates concise, project-specific architecture rules (~200-300 words) appended to `project-context.md`, automatically loaded by `dev-story` and `code-review` workflows
3. **Code Review Verification** — Confirms BMAD's code review picks up the project's `architecture.md`

The integration is idempotent — safe to re-run after standard updates.

## Reference Files

The standard is organised into 10 reference files, each optimised to ~1,500-2,000 words for efficient AI context loading. The smart reference loader (`signal-mapping.md`) maps keywords in your source code to the relevant files, loading only what's needed.

| Reference File | Domain |
|----------------|--------|
| `architecture.md` | System shape, component responsibilities, topology |
| `data-patterns.md` | Schemas, migrations, connection pools, file storage, background jobs |
| `decision-framework.md` | Choosing between defaults and approved exceptions |
| `deployment.md` | Bicep, deploy scripts, GitHub Actions, Container Apps |
| `local-development.md` | Docker Compose, dev environment, hot reload |
| `observability.md` | OpenTelemetry, logging, health endpoints |
| `repo-standards.md` | pnpm monorepo structure, naming, CLAUDE.md conventions |
| `security.md` | Entra ID authentication, Key Vault, managed identities, RBAC |
| `testing.md` | Test strategy, fixtures, coverage |
| `web-and-api-patterns.md` | Next.js App Router, Fastify routes, SSE streaming |

## Template Assets

Ready-to-use template files for project scaffolding:

**Orchestrator (Fastify server):** `server.ts`, `health-routes.ts`, `pool.ts`, `auth-middleware.ts`, `config.ts`, `sse-streaming.ts`, `Dockerfile`

**Web (Next.js frontend):** `Dockerfile`

**Infrastructure:** `main.bicep`, `dev.bicepparam`, `deploy.sh`, `init-db.sh`, `CI-and-Deploy.yaml`

**Local Development:** `docker-compose.dev.yaml`, `.env.example`

**Report Templates:** `delta-report.html` (standalone HTML structure with inline CSS for delta analysis reports — Planned)

These are read-only inputs for scaffolding and reporting. Generated project files are independent of the plugin — zero runtime dependency.

## Default Stack

The standard targets a specific technology stack:

| Layer | Standard |
|-------|----------|
| Cloud | Azure |
| Primary compute | Azure Container Apps |
| Frontend | Next.js App Router |
| Backend | Fastify on Node.js |
| Repo structure | Per-project pnpm monorepo |
| IaC | Bicep |
| CI/CD | GitHub Actions |
| Authentication | Microsoft Entra ID |
| Secrets | Azure Key Vault |
| Primary database | PostgreSQL Flexible Server |
| Observability | Azure Monitor + Application Insights + OpenTelemetry |
| Realtime | Server-Sent Events (SSE) |

## Severity Vocabulary

All analysis uses a shared four-level vocabulary. The tone is always collegial — never "violation," "non-compliant," or "failed."

| Level | Label | Meaning |
|-------|-------|---------|
| 1 | Pattern opportunity | Could follow the standard more closely, but works fine |
| 2 | Drift | Deviates without clear justification — likely unintentional |
| 3 | Significant deviation | Meaningful departure affecting maintainability or consistency |
| 4 | Critical deviation | Breaks a core pattern or creates operational/security risk |

Registered deviations (intentional, documented in the deviation registry) are acknowledged positively, not flagged as drift.

## Deviation Registry

When a project intentionally departs from the standard, the deviation is recorded in `docs/architecture-deviations.md` in the consumer project (not in the plugin). Each entry tracks:

- Sequential ID (`DEV-001`, `DEV-002`, ...)
- Pattern deviated from and the chosen alternative
- Rationale and impact assessment
- Standard version at registration time
- Status (Active / Resolved)

The registry is read by delta analysis, onboarding, and compliance checks to distinguish intentional decisions from unintentional drift. It is forward-compatible — deviations registered against older standard versions remain valid after updates.

## Versioning

The plugin uses a single version number — the plugin version is the standard version. Updates are distributed via the marketplace every 1-2 months. When the standard evolves:

1. Reference files are updated in the plugin
2. Plugin version bumps
3. Marketplace distribution propagates the update
4. `/ns-appfoundry-integrate-with-bmad` can be re-run to update project-context rules
5. Delta analysis can be re-run to assess existing projects against the updated standard

---

**Author:** Louis de Klerk — [Netsurit Innovation Team](https://github.com/louisdk/netsurit-innovate-plugins)
