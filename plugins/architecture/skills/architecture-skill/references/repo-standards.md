# Repository Standards

This document defines the standard repository structure and conventions for **single-tenant Azure applications** built on the Azure Single-Tenant Application Standard.

Its purpose is to make projects look and behave consistently so that:
- developers can move between repositories more easily
- support teams can understand applications faster
- CI/CD and deployment can follow common patterns
- Claude Skills and AI coding tools can generate toward a known structure
- architectural drift is reduced early, before it becomes operational debt

This document complements:
- `SKILL.md`
- `architecture.md`
- `decision-framework.md`
- `data-patterns.md`
- `deployment.md`
- `observability.md`
- `security.md`

---

# Repository Principles

- **One repository per application or solution.** The repo should contain the full implementation: web app, orchestrator, shared code, infra, schema, deployment automation, CI/CD, and project-specific guidance. We do not want an ecosystem of many tiny repositories for one ordinary business application unless there is a clear platform or organizational reason.
- **Monorepo by default.** Use a **pnpm monorepo** — it gives a clean home for web and orchestrator together, a natural place for shared code, unified dependency management, simpler cross-layer refactoring, easier coordination of schema, infra, and app changes, and better AI-assisted code generation support. A monorepo is the most practical default for the two-container pattern, not a goal in itself.
- **Keep the repo shape predictable.** Every project should look broadly similar. A support engineer or developer should immediately see where the web app, backend, shared code, infra, migrations, CI/CD, and project instructions live. This is one of the most important benefits of standardization.
- **Avoid over-fragmentation.** Do not create many packages, folders, or layers unless they represent a real boundary. Enough structure to stay understandable — not so much that every app becomes a miniature platform.

---

# Standard Repository Layout

A typical standard repository should look like this:

```text
.
├── apps/
│   ├── web/
│   └── orchestrator/
├── packages/
│   └── shared/
├── infra/
│   ├── main.bicep
│   ├── parameters/
│   │   ├── dev.bicepparam
│   │   ├── test.bicepparam
│   │   └── prod.bicepparam
│   └── deploy.sh
├── schema/
│   ├── init.sql
│   └── migrations/
│       ├── 001_...
│       ├── 002_...
│       └── ...
├── .github/
│   └── workflows/
├── CLAUDE.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

This is the standard baseline. Individual apps may add folders where justified, but the top-level shape should remain recognizable.

---

# Top-Level Files

- **`README.md`** — Explains what the application does, main components, how to run locally, how to deploy, and where to find key docs. Helps a new engineer orient quickly; not an exhaustive wiki.
- **`CLAUDE.md`** — Project-specific guidance for AI-assisted development. This is where teams encode local conventions, architectural constraints specific to the app, common tasks, deployment notes, testing caveats, and important domain rules. This is separate from the broader platform skill. The skill gives the standard; `CLAUDE.md` gives the repo-specific application of that standard.
- **`package.json`** — Defines workspace-level scripts, shared dev dependencies, package manager metadata, and orchestration commands for common developer workflows. The root should make the repo feel operable as one system, not just a folder containing unrelated subprojects.
- **`pnpm-workspace.yaml`** — Defines workspace packages (typically `apps/*` and `packages/*`). Do not build a deeply nested package hierarchy without clear reason.

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

- **`tsconfig.base.json`** — Shared TypeScript base config at the repo root, standardizing strictness, module resolution, aliases, and compiler options. Avoid each package inventing a wildly different TypeScript posture.

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

---

# `apps/` Directory

The `apps/` directory contains deployable application units. In the standard architecture, this normally means `apps/web` and `apps/orchestrator` — separate because the architecture defaults to separate web and orchestrator containers.

**`apps/web`** — The **Next.js App Router** application. Contains UI routes and components, frontend auth/session integration, server-side rendering logic, web-specific config, tests, and Dockerfile. Should *not* become the home for core business orchestration, database mutation logic, AI provider credentials, or broad backend integration code.

**`apps/orchestrator`** — The **Fastify** backend service. Contains APIs, business logic, validation, data access, Blob Storage integration, AI orchestration, jobs/schedules execution, backend-specific tests, and Dockerfile. This is the main runtime home for application behavior beyond presentation concerns.

**Adding another app** — Only justified when there is another real deployable unit with a distinct lifecycle or scaling pattern (e.g., a separate worker or genuinely distinct admin service). Do not add apps just to look "more modular."

---

# `packages/` Directory

The `packages/` directory contains shared code used by more than one app. Most projects only need **`packages/shared`**.

**`packages/shared`** may contain: shared types, validation schemas, DTOs, common helpers, constants, telemetry helpers, DB utility helpers, and common domain logic that truly belongs in both layers. Keep it disciplined and intentional.

**What should not go in `shared`**: web-only UI logic, orchestrator-only business logic, code that is not actually reused, deeply stateful code that creates coupling, large utility collections with no real ownership. If it is not truly shared, keep it in the app that owns it.

**When to create another package**: only when there is a clear reusable boundary worth preserving. Examples might include a dedicated database package if the app is truly complex enough, a reusable design system package for multiple apps in the same repo, or a well-bounded domain library. For ordinary business apps, resist the urge to create many packages.

---

# `infra/` Directory

Contains infrastructure-as-code and deployment assets: Bicep files, environment parameter files (`parameters/dev.bicepparam`, `test.bicepparam`, `prod.bicepparam`), `main.bicep`, and `deploy.sh`.

Aligns with the standard deployment model: Bicep for infrastructure, Azure Container Apps, ACR-backed images, environment-specific parameterization.

Keep infra code with the app — it improves traceability, coordinated changes, easier onboarding, and simpler AI-assisted understanding. Do not separate infra into another repo without a strong platform-level reason.

---

# `schema/` Directory

Contains database initialization and migration assets: `init.sql` and `migrations/`.

Migration files should be numbered, ordered, reviewable, committed, and easy to trace to application changes. Example: `001_create_core_tables.sql`, `002_add_jobs_table.sql`, `003_add_schedule_table.sql`.

Schema changes are part of the application lifecycle and should live in the same repo.

---

# `.github/workflows/` Directory

Contains standard CI/CD workflows: PR validation, build/test, deployment, and optional release workflows.

Because GitHub Actions is the standard CI/CD path, workflows should follow the standard delivery model: install dependencies, lint, type check, test, build, build/push images, deploy, verify health/readiness. Do not create a completely custom CI/CD shape for every repo without reason.

---

# Naming Conventions

**Folders** — Use boring, predictable names: `apps/web`, `apps/orchestrator`, `packages/shared`, `infra`, `schema`, `migrations`. Avoid creative names requiring tribal knowledge.

**Package names** — Scope consistently: `@sampleapp/web`, `@sampleapp/orchestrator`, `@sampleapp/shared`.

**Script names** — Keep predictable: `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, `format`, `db:migrate`, `db:reset`, `deploy:dev`, `deploy:test`, `deploy:prod`. Do not invent idiosyncratic command names unless justified.

---

# Root Script Standards

A new developer should be able to run a small number of root commands and get useful results: run apps locally, build/lint/typecheck the whole workspace, run tests, run migrations, trigger deployment helpers.

Prefer root orchestration over memorizing many subpackage commands. This also makes it easier for Claude Skills to work consistently.

---

# Dependency and Package Boundary Guidance

- **Share intentionally.** Do not move everything to the root without thought, duplicate wildly different dependency versions, or create tangled cross-dependencies.
- **Avoid cyclic dependencies** between web, orchestrator, and shared packages. The dependency graph should remain simple.
- **The orchestrator should not depend on the web app.** Shared code belongs in `packages/shared`.

---

# Documentation Placement

Keep repo-local docs close to the code: `README.md`, `CLAUDE.md`, deployment notes, migration notes, app-specific architecture notes when truly needed. Do not force teams to hunt through external docs for the basics.

Only create extra markdown docs when they provide real value. The standard docs cover the broad platform; repo-local docs should focus on what is unique to the application.

---

# What to Avoid

- One repo per tiny component
- Many small packages for one ordinary app
- Infra in a separate repo without strong reason
- Schema files hidden inside app code folders
- CI/CD scattered across many systems
- Ambiguous folder names or creative but inconsistent script names
- Shared packages that are really dumping grounds
- Package boundaries that exist only for aesthetic reasons

**Example — over-fragmented packages:**

```text
# Instead of this (too many packages for a simple app):
packages/
  ├── types/
  ├── utils/
  ├── validation/
  ├── db-helpers/
  ├── constants/
  └── logger/

# Prefer this — one shared package until real boundaries emerge:
packages/
  └── shared/
```

---

# Closing: Checklist, Litmus Test, and Evolution

**A production-oriented repository should include:** one repo per application, pnpm monorepo, `apps/web`, `apps/orchestrator`, `packages/shared`, `infra/`, `schema/`, `.github/workflows/`, `README.md`, `CLAUDE.md`, root scripts for common workflows, predictable package naming, committed migrations, deployment assets in the same repo.

**Litmus test.** A developer, support engineer, or Claude-based workflow should quickly answer: Where is the web app? The backend? Shared code? Infra? Migrations? How do I run it? Deploy it? Which scripts are the standard entry points? If those questions are hard to answer, the repo structure is too ad hoc.

**Evolution.** Start with the baseline first — monorepo structure, predictable layout, root scripts, infra and schema in repo, shared package discipline, CI/CD workflows, `CLAUDE.md`. More advanced structures (additional shared packages, specialized worker apps, internal design system packages, elaborate workspace tooling) can come later if justified. The goal is not to make every repo identical in every detail, but to make most repos similar enough to be easy to understand, support, and extend.
