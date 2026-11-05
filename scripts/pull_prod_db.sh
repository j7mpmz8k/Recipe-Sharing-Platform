#!/usr/bin/env bash
# scripts/pull_prod_db.sh
# Streams a remote production PostgreSQL database directly into local staging over SSH.

set -eo pipefail

# Auto-load variables from .env in the project root if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env}"
if [ -f "${ENV_FILE}" ]; then
    set -a
    # shellcheck disable=SC1090
    . "${ENV_FILE}"
    set +a
fi

DB_NAME="${DB_NAME:-recipe_db}"
DB_USER="${DB_USER:-admin}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

PROD_SSH_HOST="${PROD_SSH_HOST:-$1}"
PROD_SSH_PORT="${PROD_SSH_PORT:-48222}"
PROD_DB_NAME="${PROD_DB_NAME:-recipe_db}"
PROD_DB_USER="${PROD_DB_USER:-postgres}"

if [ -n "${DB_PASSWORD:-}" ]; then
    export PGPASSWORD="${DB_PASSWORD}"
fi

echo "=================================================="
echo "   Recipe Sharing Platform - Database Sync Tool   "
echo "=================================================="

if [ -z "$PROD_SSH_HOST" ]; then
    echo ""
    read -rp "Enter production SSH host (e.g. user@your-server-ip): " PROD_SSH_HOST
    if [ -z "$PROD_SSH_HOST" ]; then
        echo "[Error] Production SSH host is required. Aborted."
        exit 1
    fi
fi

echo ""
echo "Sync Configuration:"
echo "  Remote Host:      ${PROD_SSH_HOST}:${PROD_SSH_PORT}"
echo "  Remote DB:        ${PROD_DB_NAME} (User: ${PROD_DB_USER})"
echo "  Target (Local):   ${DB_USER}@${DB_HOST}:${DB_PORT} -> Database: \"${DB_NAME}\""
echo "  Method:           Direct SSH Stream (pg_dump | psql)"
echo ""

read -rp "⚠️  WARNING: Overwrite local database \"${DB_NAME}\" with production data? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Operation canceled by user."
    exit 0
fi

# Ensure local target database exists before streaming into it
if ! psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" 2>/dev/null | grep -q 1; then
    echo "Local database \"${DB_NAME}\" does not exist. Creating it now..."
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE \"${DB_NAME}\";" 2>/dev/null || true
fi

echo ""
echo "Streaming database from production to local staging..."

REMOTE_DUMP_CMD="if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^recipe_db$'; then
    docker exec -i recipe_db pg_dump -U ${PROD_DB_USER} -d ${PROD_DB_NAME} --clean --if-exists --no-owner --no-privileges
else
    pg_dump -U ${PROD_DB_USER} -d ${PROD_DB_NAME} --clean --if-exists --no-owner --no-privileges
fi"

ssh -p "${PROD_SSH_PORT}" "${PROD_SSH_HOST}" "${REMOTE_DUMP_CMD}" \
    | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"

echo ""
echo "✓ Database successfully synced from production to \"${DB_NAME}\"!"
