#!/usr/bin/env bash
# scripts/sql_prod.sh
# Connects over SSH directly into an interactive PostgreSQL shell on production.

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Auto-load variables from .env in project root if present
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env}"
if [ -f "${ENV_FILE}" ]; then
    set -a
    # shellcheck disable=SC1090
    . "${ENV_FILE}"
    set +a
fi

PROD_SSH_HOST="${PROD_SSH_HOST:-super_admin@jcardon.me}"
PROD_SSH_PORT="${PROD_SSH_PORT:-48222}"
PROD_DB_NAME="${PROD_DB_NAME:-recipe_db}"
PROD_DB_USER="${PROD_DB_USER:-postgres}"

if [ -z "$PROD_SSH_HOST" ]; then
    echo "[Error] PROD_SSH_HOST is not configured in .env. Aborted."
    exit 1
fi

echo "=================================================="
echo "   Recipe Sharing Platform - Production psql CLI  "
echo "=================================================="
echo "  Target Server:   ${PROD_SSH_HOST}:${PROD_SSH_PORT}"
echo "  Target Database: ${PROD_DB_NAME} (User: ${PROD_DB_USER})"
echo "  Connecting to live PostgreSQL shell..."
echo "  (Type \\q and press Enter to exit anytime)"
echo "=================================================="
echo ""

# -t allocates a pseudo-terminal for an interactive psql session inside docker
exec ssh -t -p "${PROD_SSH_PORT}" "${PROD_SSH_HOST}" \
    "docker exec -it recipe_db psql -U ${PROD_DB_USER} -d ${PROD_DB_NAME}"
