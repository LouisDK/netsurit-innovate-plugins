# Local Development

This document defines the standard local development setup for **single-tenant Azure applications** built on the Azure Single-Tenant Application Standard.

Its purpose is to ensure that local development environments are consistent, easy to set up, and close enough to production to catch real issues early — while remaining simple enough that a single developer can run the full stack on their machine.

This document complements:
- `SKILL.md`
- `architecture.md`
- `deployment.md`
- `data-patterns.md`

---

# Local Development Principles

## Match production services locally

Local development should use the same database engine and storage model as production. Use PostgreSQL locally, not SQLite. Use Azurite for Blob Storage emulation, not the filesystem.

This prevents a class of bugs that only appear when deploying to real Azure services.

## Keep local setup simple

A new developer should be able to start working with:
1. Clone the repo
2. `cp .env.example .env`
3. `docker compose -f docker-compose.dev.yaml up -d`
4. `pnpm install`
5. `pnpm db:migrate` (or equivalent)
6. `pnpm dev`

Avoid setups that require manual Azure resource provisioning, VPN connections, or shared cloud databases for local development.

## Run the app natively, not in Docker

Use Docker Compose for **infrastructure services** (PostgreSQL, Azurite) but run the application itself natively with `pnpm dev`. This gives faster iteration, better debugging, and hot reload.

Docker is used for the application only when building production images.

## Use .env for local configuration

Environment variables should be the primary configuration mechanism, matching production's Key Vault / Container App secrets model. The `.env` file provides these locally.

---

# Docker Compose for Local Services

## Standard setup

The `../../../assets/docker-compose.dev.yaml` template provides:
- **PostgreSQL 16** on port 5433 (offset from the default 5432 to avoid conflicts with any locally installed PostgreSQL)
- **Azurite** on ports 10100-10102 (Azure Storage emulator for Blob, Queue, and Table)

## Usage

```bash
# Start local services
docker compose -f docker-compose.dev.yaml up -d

# Check service health
docker compose -f docker-compose.dev.yaml ps

# View PostgreSQL logs
docker compose -f docker-compose.dev.yaml logs postgres

# Stop services (data persists in named volume)
docker compose -f docker-compose.dev.yaml down

# Stop and remove data
docker compose -f docker-compose.dev.yaml down -v
```

## Port choices

| Service | Local Port | Container Port | Notes |
|---------|-----------|----------------|-------|
| PostgreSQL | 5433 | 5432 | Offset to avoid conflicts |
| Azurite Blob | 10100 | 10000 | Azure Storage emulator |
| Azurite Queue | 10101 | 10001 | Azure Storage emulator |
| Azurite Table | 10102 | 10002 | Azure Storage emulator |

---

# Environment Variables

## .env.example convention

Every project should include a `.env.example` file at the repository root. This file documents all required environment variables with safe default values for local development.

The `../../../assets/.env.example` template provides defaults that match the Docker Compose services.

## Setup

```bash
cp .env.example .env
# Edit .env if you need to customize values
```

## Key variables

| Variable | Local Value | Production Source |
|----------|-------------|-------------------|
| `DATABASE_URL` | `postgresql://appuser:localdevpassword@localhost:5433/appdb` | Key Vault secret |
| `AZURE_STORAGE_CONNECTION_STRING` | Azurite default connection string | Key Vault secret |
| `PORT` | `3001` | Container App configuration |
| `NODE_ENV` | `development` | Container App configuration |
| `AZURE_AD_TENANT_ID` | Your dev tenant ID | Key Vault secret |
| `AZURE_AD_CLIENT_ID` | Your dev app registration ID | Key Vault secret |

## What changes between local and production

| Concern | Local | Production |
|---------|-------|------------|
| Database | Docker Compose PostgreSQL | Azure Database for PostgreSQL Flexible Server |
| Blob Storage | Azurite | Azure Blob Storage |
| Secrets | `.env` file | Azure Key Vault |
| Identity | Dev bypass header or dev tenant | Microsoft Entra ID |
| Observability | Console logging | Application Insights + Log Analytics |
| SSL | Not required | Required (`sslmode=require`) |

---

# Dev Scripts

## Standard package.json scripts

Projects should define consistent dev scripts in the root `package.json` or per-package:

```json
{
  "scripts": {
    "dev": "pnpm --filter './packages/*' --parallel dev",
    "dev:web": "pnpm --filter @{app-name}/web dev",
    "dev:orchestrator": "pnpm --filter @{app-name}/orchestrator dev",
    "build": "pnpm --filter @{app-name}/shared build && pnpm --filter './packages/*' --parallel build",
    "typecheck": "pnpm --filter './packages/*' --parallel typecheck",
    "lint": "pnpm --filter './packages/*' --parallel lint",
    "test": "pnpm --filter './packages/*' --parallel test",
    "db:migrate": "pnpm --filter @{app-name}/orchestrator db:migrate",
    "db:seed": "pnpm --filter @{app-name}/orchestrator db:seed"
  }
}
```

## Running both services

The standard approach is to run both services in parallel:

```bash
# In one terminal (or use the root dev script)
pnpm dev
```

This starts both the Next.js web app (typically on port 3000) and the Fastify orchestrator (typically on port 3001) with hot reload.

---

# Database Initialization and Migration

## Local database setup

After starting Docker Compose:

```bash
# Run baseline schema and migrations
pnpm db:migrate
```

This should run `schema/init.sql` (idempotent baseline) followed by all numbered `schema/migrations/*.sql` files.

The `../../../assets/infra/init-db.sh` script provides a reference implementation. For local use, the orchestrator package typically wraps this in a `db:migrate` npm script.

## Migration workflow

1. Write a new migration file: `schema/migrations/003_add_user_preferences.sql`
2. Make migrations idempotent (use `IF NOT EXISTS`, `CREATE OR REPLACE`, etc.)
3. Run locally: `pnpm db:migrate`
4. Verify the migration works
5. Commit the migration file with the feature code

## Connecting to the local database

```bash
# Direct psql connection
psql postgresql://appuser:localdevpassword@localhost:5433/appdb

# Or use the DATABASE_URL from .env
source .env && psql "$DATABASE_URL"
```

---

# Authentication in Local Development

## Dev bypass

The `auth-middleware.ts` template supports a development bypass via the `x-dev-bypass: true` header. When `NODE_ENV=development`, this header skips JWT verification and attaches a development user with all roles.

This avoids needing a real Entra ID token for local API testing.

## Testing with real tokens

For integration testing with real Entra ID:
1. Register an app in your development Azure AD tenant
2. Set `AZURE_AD_TENANT_ID` and `AZURE_AD_CLIENT_ID` in `.env`
3. Remove the `x-dev-bypass` header from requests

---

# What Not to Do

- Do not use a shared cloud database for local development
- Do not require VPN or Azure access to run the app locally
- Do not commit `.env` files to source control
- Do not use SQLite or in-memory databases as substitutes for PostgreSQL
- Do not run the application inside Docker for development (use Docker only for infrastructure services)
- Do not hard-code connection strings or secrets in application code