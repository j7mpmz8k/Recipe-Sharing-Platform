#!/usr/bin/env bash
# scripts/start_prod.sh
# Connects over SSH to start the production Docker containers back up.

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

PROD_SSH_HOST="${1:-${PROD_SSH_HOST}}"
PROD_SSH_PORT="${PROD_SSH_PORT:-48222}"

if [ -z "$PROD_SSH_HOST" ]; then
    echo "[Error] PROD_SSH_HOST is not configured in .env. Aborted."
    exit 1
fi

echo "=================================================="
echo "   Recipe Sharing Platform - Start Production     "
echo "=================================================="
echo "  Target Server: ${PROD_SSH_HOST}:${PROD_SSH_PORT}"
echo ""

echo "==> Starting production services..."
ssh -p "${PROD_SSH_PORT}" "${PROD_SSH_HOST}" '
    set -eo pipefail
    cd ~/docker_services/recipe-sharing-platform
    docker compose start || docker compose up -d
    echo ""
    echo "==> Production services status:"
    docker compose ps
'

echo ""
echo "✓ Production containers are back online!"
