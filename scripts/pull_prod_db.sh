#!/usr/bin/env bash
# scripts/pull_prod_db.sh
# Streams a remote production PostgreSQL database directly into local staging over SSH.

set -eo pipefail

PROD_SSH_HOST="${PROD_SSH_HOST:-$1}"
PROD_DB_NAME="${PROD_DB_NAME:-recipe_db}"
PROD_DB_USER="${PROD_DB_USER:-postgres}"

LOCAL_DB_NAME="${LOCAL_DB_NAME:-${DB_NAME:-recipe_db_staging}}"
LOCAL_DB_USER="${LOCAL_DB_USER:-${DB_USER:-admin}}"
LOCAL_DB_HOST="${LOCAL_DB_HOST:-${DB_HOST:-localhost}}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-${DB_PORT:-5432}}"

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
echo "  Source (Remote):  ${PROD_DB_USER}@${PROD_SSH_HOST} -> Database: \"${PROD_DB_NAME}\""
echo "  Target (Local):   ${LOCAL_DB_USER}@${LOCAL_DB_HOST}:${LOCAL_DB_PORT} -> Database: \"${LOCAL_DB_NAME}\""
echo "  Method:           Direct SSH Stream (pg_dump | psql)"
echo ""

read -rp "⚠️  WARNING: Overwrite local database \"${LOCAL_DB_NAME}\" with production data? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Operation canceled by user."
    exit 0
fi

echo ""
echo "Streaming database from production to local staging..."
ssh "${PROD_SSH_HOST}" "pg_dump -U ${PROD_DB_USER} -d ${PROD_DB_NAME} --clean --if-exists --no-owner --no-privileges" \
    | psql -h "${LOCAL_DB_HOST}" -p "${LOCAL_DB_PORT}" -U "${LOCAL_DB_USER}" -d "${LOCAL_DB_NAME}"

echo ""
echo "✓ Database successfully synced from production to \"${LOCAL_DB_NAME}\"!"
