#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# init-db.sh — Database initialization and migration runner
#
# This is a reference template. Copy to infra/init-db.sh in your project
# and adapt paths and SQL conventions to your application.
#
# Usage:
#   ./infra/init-db.sh [DATABASE_URL]
#
# If DATABASE_URL is not provided as an argument, reads from the
# DATABASE_URL environment variable.
#
# Behavior:
#   1. Runs schema/init.sql if it exists (idempotent baseline)
#   2. Runs all schema/migrations/*.sql files in sort order
#   3. Warns on individual migration failure but continues
#      (idempotent SQL returns warnings on re-run)
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Resolve DATABASE_URL
DB_URL="${1:-${DATABASE_URL:-}}"

if [[ -z "$DB_URL" ]]; then
  echo "ERROR: DATABASE_URL not provided."
  echo "Usage: $0 [DATABASE_URL]"
  echo "   or: DATABASE_URL=... $0"
  exit 1
fi

# Auto-detect SSL mode: add ?sslmode=require unless connecting to localhost
if [[ "$DB_URL" != *"sslmode="* ]]; then
  if [[ "$DB_URL" != *"localhost"* && "$DB_URL" != *"127.0.0.1"* ]]; then
    if [[ "$DB_URL" == *"?"* ]]; then
      DB_URL="${DB_URL}&sslmode=require"
    else
      DB_URL="${DB_URL}?sslmode=require"
    fi
  fi
fi

SCHEMA_DIR="${PROJECT_ROOT}/schema"

# Run baseline init.sql if it exists
if [[ -f "${SCHEMA_DIR}/init.sql" ]]; then
  echo "[init-db] Running schema/init.sql..."
  if psql "$DB_URL" -f "${SCHEMA_DIR}/init.sql"; then
    echo "[init-db] init.sql completed successfully"
  else
    echo "[init-db] WARNING: init.sql returned errors (may be safe if idempotent)"
  fi
else
  echo "[init-db] No schema/init.sql found, skipping baseline."
fi

# Run numbered migrations in sort order
MIGRATIONS_DIR="${SCHEMA_DIR}/migrations"
if [[ -d "$MIGRATIONS_DIR" ]]; then
  migration_count=0
  for migration in $(find "$MIGRATIONS_DIR" -name '*.sql' | sort); do
    migration_name="$(basename "$migration")"
    echo "[init-db] Running migration: $migration_name"
    if psql "$DB_URL" -f "$migration"; then
      echo "[init-db] $migration_name completed"
    else
      echo "[init-db] WARNING: $migration_name returned errors (may be safe if idempotent)"
    fi
    migration_count=$((migration_count + 1))
  done
  echo "[init-db] Ran $migration_count migration(s)"
else
  echo "[init-db] No schema/migrations/ directory found, skipping migrations."
fi

echo "[init-db] Database initialization complete."
