---
name: ns-appfoundry-scaffold
description: "Guided project scaffolding for Azure single-tenant applications. Run this skill when a developer wants to generate a new project from the architecture standard, says 'scaffold my project', 'generate project files', 'set up a new project', 'create project from standard', 'bootstrap my app', or invokes /ns-appfoundry-scaffold. This skill reads architecture.md, presents a scaffolding plan, handles deviations conversationally, and generates parameterised project files — it is the guided code generator, not a structural check or code review."
---

# Guided Project Scaffolding

An intelligent, guided code generation process that reads a project's architecture decisions and produces a working project structure. The scaffold skill assesses what can be generated, presents its plan, handles deviations through conversation, and then generates parameterised files from template assets.

This is not simple template copying. It is a four-phase process: assessment, confirmation, generation, and verification. For standard-architecture projects, full scaffolding. For significantly deviated architectures, partial or no scaffolding with clear explanation.

## Philosophy

This skill is a helpful colleague setting up a project with you. It explains what it proposes to do and why, asks before acting, and respects your architecture decisions — even when they differ from the standard. Deviations are documented decisions, not failures. The words "violation," "non-compliant," and "failed" are never used.

When the standard recommends one thing and your architecture.md says another, the skill describes both, explains the trade-off, and asks you to confirm. That's it — no judgment.

## When to Run

- **Greenfield setup** — starting a new Azure single-tenant application from scratch
- **New project from standard** — bootstrapping a project that should follow the AppFoundry architecture
- **Starting from the standard** — you have an architecture.md and want the standard project files generated

## Files Read

- **`architecture.md`** — the project's architecture decision document (in `_bmad-output/planning-artifacts/` or project root)
- **`plugins/architecture/assets/`** — template asset files used as generation sources
- **`plugins/architecture/templates/deviation-registry.md`** — schema and blank entry template for deviation registration
- **`plugins/architecture/.claude-plugin/plugin.json`** — current standard version for deviation registry entries
- **`docs/architecture-deviations.md`** — existing deviation registry in the consumer project (if it exists)

This skill writes to the consumer project: generated files and deviation registry entries.

## How This Skill Works

When invoked, follow these steps in order.

### Step 1: Invocation & Context

Accept a project name as an argument. If no project name is provided, ask for one.

Locate the project's `architecture.md`. Search in this order:
1. `_bmad-output/planning-artifacts/architecture.md`
2. `_bmad-output/planning-artifacts/*architecture*.md` — if multiple files match, prefer the one named exactly `architecture.md` (without date suffix or other qualifiers). If still ambiguous, present the matching filenames to the developer and ask which one to use.
3. `architecture.md` at the project root
4. `docs/architecture.md`

If `architecture.md` is not found:

> "No architecture.md found — run BMAD create-architecture first or create one manually. The scaffold skill needs architecture decisions to determine what to generate and how to parameterise the output."

Stop here. The skill cannot proceed without architecture decisions.

If found, read the complete `architecture.md` file.

### Step 2: Architecture Analysis

Parse `architecture.md` to extract project-specific values:

| Value | Where to look | Default if not specified |
|---|---|---|
| Project name / app name | Project context, title, or explicit mention | Use the argument provided at invocation |
| Database name | Data layer decisions, PostgreSQL configuration | `appdb` |
| Container App names | Deployment decisions, Azure resource naming | `{app-name}-orchestrator`, `{app-name}-web` |
| Auth method | Security decisions, identity provider | Entra ID OIDC |
| Backend framework | Technology decisions, server framework | Fastify |
| Frontend framework | Technology decisions, UI framework | Next.js |
| Compute platform | Deployment decisions, hosting | Azure Container Apps |
| IaC tool | Infrastructure decisions | Bicep |
| CI/CD platform | Pipeline decisions | GitHub Actions |
| Package manager | Repository decisions | pnpm |

Compare each extracted value against the standard defaults. Any difference is a potential deviation — collect these for Step 4.

### Step 3: Scaffolding Plan Presentation

Present the full scaffolding plan organised by category. List every file that will be generated with its target path and source template asset.

```
## Scaffolding Plan for {project-name}

### Server Boilerplate (from assets/orchestrator/)
- `apps/orchestrator/src/server.ts` ← assets/orchestrator/server.ts
- `apps/orchestrator/src/health-routes.ts` ← assets/orchestrator/health-routes.ts
- `apps/orchestrator/src/auth-middleware.ts` ← assets/orchestrator/auth-middleware.ts
- `apps/orchestrator/src/pool.ts` ← assets/orchestrator/pool.ts
- `apps/orchestrator/src/config.ts` ← assets/orchestrator/config.ts
- `apps/orchestrator/src/sse-streaming.ts` ← assets/orchestrator/sse-streaming.ts
- `apps/orchestrator/Dockerfile` ← assets/orchestrator/Dockerfile

### Web Frontend (from assets/web/)
- `apps/web/Dockerfile` ← assets/web/Dockerfile

### Infrastructure (from assets/infra/)
- `infra/main.bicep` ← assets/infra/main.bicep
- `infra/dev.bicepparam` ← assets/infra/dev.bicepparam
- `.github/workflows/CI-and-Deploy.yaml` ← assets/infra/CI-and-Deploy.yaml
- `infra/deploy.sh` ← assets/infra/deploy.sh
- `schema/init-db.sh` ← assets/infra/init-db.sh

### Docker & Local Dev (from assets/)
- `docker-compose.dev.yaml` ← assets/docker-compose.dev.yaml
- `.env.example` ← assets/.env.example

### Parameterised Values
- Project name: {project-name}
- Database name: {database-name}
- Container App names: {container-app-names}
```

Show which parameterised values will be applied from the architecture analysis.

If deviations were detected in Step 2, note them here:
> "{N} deviation(s) detected from the standard. Let's walk through them before proceeding."

If the architecture deviates significantly enough that some categories cannot be scaffolded (e.g., a different compute platform means Bicep templates don't apply), mark those categories clearly:
> "⏭ **Infrastructure** — skipped. Your architecture uses Terraform instead of Bicep. The standard Bicep templates don't apply."

### Step 4: Deviation Detection & Confirmation

For each deviation detected in Step 2, communicate conversationally:

> "Your architecture.md specifies **{chosen alternative}** for {concern area}. The standard recommends **{standard recommendation}** because {brief reason why the standard exists}. Your approach is completely valid — {acknowledge the alternative's merits if applicable}.
>
> Would you like to confirm this as a registered deviation? This documents the decision so that future checks and analysis acknowledge it as intentional."

Wait for the developer's response to each deviation before proceeding to the next.

If the developer confirms the deviation, register it in `docs/architecture-deviations.md`:

1. Check if `docs/architecture-deviations.md` exists in the consumer project
2. If not, create the `docs/` directory if needed, then create the file with the header from `plugins/architecture/templates/deviation-registry.md`:
   - Replace `{{STANDARD_VERSION}}` with the version from `plugins/architecture/.claude-plugin/plugin.json` (currently `0.1.0`)
   - Replace `{{CREATION_DATE}}` with the current date
   - Include the schema section and blank entry template comment
3. Add a deviation entry using the format from the deviation registry template:

```markdown
### DEV-{NNN}: {Short Title}

| Field | Value |
|---|---|
| **ID** | DEV-{NNN} |
| **Pattern** | `{domain} / {concern}` |
| **Standard Recommendation** | {what the standard says} |
| **Chosen Alternative** | {what architecture.md specifies} |
| **Rationale** | {developer's rationale from confirmation} |
| **Impact Assessment** | {what trade-offs this introduces} |
| **Registered By** | ns-appfoundry-scaffold |
| **Date** | {current date} |
| **Status** | Active |
| **Standard Version** | {version from plugin.json} |
```

Use sequential DEV-NNN IDs: start from DEV-001 if the file is new, or continue the existing sequence.

If the developer declines to register the deviation, note it but do not create a registry entry. Ask if they want to adjust their architecture.md instead.

### Step 5: User Confirmation

After all deviations have been addressed, present a final summary:

```
## Ready to Generate

**Project:** {project-name}
**Files to generate:** {count}
**Deviations registered:** {count}
**Categories skipped:** {list or "none"}

Shall I proceed with generation?
```

Wait for explicit user approval before proceeding.

### Step 6: Generation Phase

Generate all project files from template assets. Process each category in order, skipping any categories marked as skipped in Step 3.

**Directory Setup**

Before generating files, create the target directories if they don't exist:

- `apps/orchestrator/src/`
- `apps/web/`
- `infra/`
- `.github/workflows/`
- `schema/`

**Traceability Comment Headers**

Prepend a traceability comment header to every generated file. Use file-type-aware comment syntax:

| File type | Syntax | First line |
|---|---|---|
| TypeScript (`.ts`) | `//` | `// Generated by ns-appfoundry-scaffold from assets/{source-path}` |
| Bicep (`.bicep`, `.bicepparam`) | `//` | `// Generated by ns-appfoundry-scaffold from assets/{source-path}` |
| YAML (`.yaml`) | `#` | `# Generated by ns-appfoundry-scaffold from assets/{source-path}` |
| Dockerfile | `#` | `# Generated by ns-appfoundry-scaffold from assets/{source-path}` |
| Shell (`.sh`) | `#` | `# Generated by ns-appfoundry-scaffold from assets/{source-path}` |
| Env (`.env.example`) | `#` | `# Generated by ns-appfoundry-scaffold from assets/{source-path}` |

Optional second line — add when the file maps to a specific architecture pattern:
```
// Pattern reference: {reference-domain}.md § {section-name}
```

Insert the header before the file's first line of content, followed by a blank line to separate the header from the file body.

**Parameterisation**

After reading each template asset and before writing, replace these placeholders with project-specific values extracted in Step 2:

| Placeholder | Replace with | Notes |
|---|---|---|
| `{app-name}` | Project name from architecture.md / Step 1 argument | Found in docker-compose container names, Dockerfile package refs, auth-middleware role names, health-routes role comment |
| `appdb` | Database name from architecture.md (default: `appdb`) | Found in docker-compose POSTGRES_DB/healthcheck, .env.example DATABASE_URL, dev.bicepparam, main.bicep default param, deploy.sh |
| `appuser` | DB user from architecture.md (default: `appuser`) | **Only** replace in docker-compose.dev.yaml (POSTGRES_USER, healthcheck) and .env.example (DATABASE_URL). Do **not** replace `appuser` in Dockerfiles — that is the Node.js runtime user, not the database user. |
| `sampleapp` | Project name from architecture.md / Step 1 argument | **Only** replace in `dev.bicepparam` and `main.bicep`. These Bicep files use `sampleapp` as the sample project name in resource names (`param appName`, Container App names, ACR name, Key Vault name, etc.). Replace all occurrences of the literal string `sampleapp` with the project name. |

If architecture.md does not specify a different value for `appdb` or `appuser`, leave the defaults as-is — no replacement needed.

**File Generation**

For each category below, read the source template asset, apply parameterisation, prepend the traceability header, and write to the target path. Report progress after each category.

Before writing each file, check if the target path already exists. If it does, ask the developer: "File `{path}` already exists. Overwrite? (y/n)". Skip the file if they decline.

**Category 1: Server Boilerplate** (from `assets/orchestrator/`)

If backend framework deviation was confirmed (not Fastify), skip all `.ts` files in this category. Include Dockerfiles only.

| Source Asset | Target Path |
|---|---|
| `assets/orchestrator/server.ts` | `apps/orchestrator/src/server.ts` |
| `assets/orchestrator/health-routes.ts` | `apps/orchestrator/src/health-routes.ts` |
| `assets/orchestrator/auth-middleware.ts` | `apps/orchestrator/src/auth-middleware.ts` |
| `assets/orchestrator/pool.ts` | `apps/orchestrator/src/pool.ts` |
| `assets/orchestrator/config.ts` | `apps/orchestrator/src/config.ts` |
| `assets/orchestrator/sse-streaming.ts` | `apps/orchestrator/src/sse-streaming.ts` |
| `assets/orchestrator/Dockerfile` | `apps/orchestrator/Dockerfile` |

Deviation-aware adjustments:
- **Auth deviation (not Entra ID):** Generate `auth-middleware.ts` but prepend an extra comment after the traceability header: `// NOTE: This template uses Entra ID OIDC. Your project uses {alternative} — adapt accordingly.`
- **Database deviation (not PostgreSQL):** Skip `pool.ts`. Adjust or note in `docker-compose.dev.yaml` and `.env.example` during their respective categories.
- **Package manager deviation (not pnpm):** When generating `assets/orchestrator/Dockerfile`, replace `pnpm` commands (`pnpm install`, `pnpm --filter`, `corepack prepare pnpm`) with the equivalent for the alternative package manager.

> "✅ Server boilerplate generated — {N} files written to `apps/orchestrator/`"

**Category 2: Web Frontend** (from `assets/web/`)

If frontend framework deviation was confirmed (not Next.js), skip this category entirely.

If package manager deviation was confirmed (not pnpm), replace `pnpm` commands in the web Dockerfile with the equivalent for the alternative package manager.

| Source Asset | Target Path |
|---|---|
| `assets/web/Dockerfile` | `apps/web/Dockerfile` |

> "✅ Web frontend generated — Dockerfile written to `apps/web/`"

**Category 3: Infrastructure** (from `assets/infra/`)

If compute platform deviation was confirmed (not Container Apps), skip `main.bicep`, `dev.bicepparam`, and `deploy.sh`. Keep `init-db.sh` if PostgreSQL is used.

If database deviation was confirmed (not PostgreSQL), skip `init-db.sh` — it is PostgreSQL-specific (uses `psql`).

If IaC tool deviation was confirmed (not Bicep), skip `main.bicep` and `dev.bicepparam`. Keep `deploy.sh` if still applicable.

If CI/CD platform deviation was confirmed (not GitHub Actions), skip `CI-and-Deploy.yaml`.

| Source Asset | Target Path |
|---|---|
| `assets/infra/main.bicep` | `infra/main.bicep` |
| `assets/infra/dev.bicepparam` | `infra/dev.bicepparam` |
| `assets/infra/CI-and-Deploy.yaml` | `.github/workflows/CI-and-Deploy.yaml` |
| `assets/infra/deploy.sh` | `infra/deploy.sh` |
| `assets/infra/init-db.sh` | `schema/init-db.sh` |

After writing shell scripts (`deploy.sh`, `init-db.sh`), set executable permission: `chmod +x` on each.

> "✅ Infrastructure generated — {N} files written to `infra/`, `.github/workflows/`, `schema/`"

**Category 4: Docker & Local Dev** (from `assets/`)

| Source Asset | Target Path |
|---|---|
| `assets/docker-compose.dev.yaml` | `docker-compose.dev.yaml` |
| `assets/.env.example` | `.env.example` |

Deviation-aware adjustments for database deviation (not PostgreSQL):
- `docker-compose.dev.yaml`: Remove or replace the postgres service definition and adjust healthcheck. Add a comment noting the alternative database.
- `.env.example`: Remove or adapt `DATABASE_URL`. Add a comment noting the alternative.

> "✅ Docker & local dev generated — 2 files written to project root"

**Generation Summary**

After all categories are processed, present a summary:

```
## Generation Complete

**Files generated:** {total count}
**Files skipped:** {count} (due to deviations)
**Parameterised values applied:**
- Project name: {value}
- Database name: {value}
- DB user: {value} (if changed from default)

All generated files include traceability comment headers linking to their source template.
```

### Step 7: Verification Phase

Verify that the generated project is functional. This is a best-effort check — verification failures are **not** scaffold failures. Report results clearly and suggest next steps.

**Step 7a: Compilation Check**

Check if `package.json` exists in the consumer project root.

If no `package.json` exists:

> "No `package.json` found — the generated files are templates that need project setup. Create `package.json` with the dependencies listed in the template imports (fastify, @fastify/cors, pg, etc.) and configure your build toolchain before the project will compile. Skip to verification summary."

Skip compilation and health checks. Proceed to the verification summary.

If `package.json` exists, attempt:

1. Run `pnpm install` (or the project's package manager equivalent)
2. Run `pnpm build` (or the project's build command equivalent)

Report the result:
- **Success:** "Compilation passed — the generated project builds successfully."
- **Failure:** Report the error output clearly. Do **not** mark the scaffold as failed — suggest what the developer needs to fix (missing dependencies, TypeScript config, etc.).

**Step 7b: Health Endpoint Check**

If compilation failed or was skipped, skip the health check:

> "Skipping health endpoint check — compilation must succeed first."

If compilation succeeded:

1. Start the server (e.g., `pnpm start` or `node dist/server.js`)
2. Send a request to `/api/health`
3. Confirm a 200 response
4. Stop the server

Report the result:
- **Success:** "Health endpoint responds — `/api/health` returned 200."
- **Failure:** Report what happened. Suggest possible causes (missing environment variables, database not running, port conflict).

**Step 7c: Verification Summary**

Present a final verification report:

```
## Verification Results

| Check | Result | Notes |
|---|---|---|
| Compilation | {✅ Passed / ❌ Failed / ⏭ Skipped} | {details} |
| Health endpoint | {✅ Passed / ❌ Failed / ⏭ Skipped} | {details} |

**Overall:** {summary}
```

If everything passed:
> "Scaffolding complete — the generated project compiles and the health endpoint responds. You have a working project skeleton ready for development."

If anything failed or was skipped:
> "Scaffolding complete — files have been generated successfully. {Describe what needs attention.} The generated files are correct templates — the issues above are project setup tasks, not scaffold problems."

Verification failures are informational. The scaffold skill is a code generator, not a complete project bootstrapper — it provides the standard files, not the full build configuration.

## What This Skill Does Not Do

- **Structural scanning** — use `/ns-appfoundry-check` for a quick compliance scan of an existing project
- **Code review** — use `/ns-appfoundry-code-review` for deep pattern analysis against the standard
- **Modify existing files** — scaffolding is for new projects; it does not overwrite existing source files
- **Work without architecture.md** — architecture decisions are required input; run BMAD create-architecture first
- **Guarantee full scaffolding** — for significantly deviated architectures, scaffolding may be partial or not possible

## References

| Reference | Used for... |
|---|---|
| `assets/orchestrator/*` | Server boilerplate template files |
| `assets/web/*` | Web frontend template files |
| `assets/infra/*` | Infrastructure template files |
| `assets/docker-compose.dev.yaml` | Local development template |
| `assets/.env.example` | Environment variable template |
| `templates/deviation-registry.md` | Deviation entry schema and blank template |
| `references/signal-mapping.md` | Not used — scaffold reads architecture.md directly (greenfield projects have no source files to scan). Architecture doc Cross-Cutting Concern Mapping lists scaffold as a consumer; this is a documented exception for the greenfield use case. |
