#!/usr/bin/env bash
# scripts/tunnel_prod.sh
# Establishes an encrypted SSH tunnel to access the production web application
# (listening internally on 127.0.0.1:3000) from http://localhost:8080 on your laptop.

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Auto-load variables from .env in the project root if present
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env}"
if [ -f "${ENV_FILE}" ]; then
    set -a
    # shellcheck disable=SC1090
    . "${ENV_FILE}"
    set +a
fi

PROD_SSH_HOST="${PROD_SSH_HOST:-$2}"
PROD_SSH_PORT="${PROD_SSH_PORT:-48222}"
LOCAL_PORT="${1:-${TUNNEL_PORT:-8080}}"
REMOTE_PORT="${REMOTE_PORT:-3000}"

if [ -z "$PROD_SSH_HOST" ]; then
    echo "[Error] PROD_SSH_HOST is not configured in .env. Aborted."
    exit 1
fi

trap 'echo -e "\n[INFO] SSH tunnel closed."; exit 0' INT TERM

echo "=================================================="
echo "    Recipe Sharing Platform - Production Tunnel   "
echo "=================================================="
echo "  Remote Host:  ${PROD_SSH_HOST}:${PROD_SSH_PORT}"
echo "  Forwarding:   http://localhost:${LOCAL_PORT} -> Remote 127.0.0.1:${REMOTE_PORT}"
echo "=================================================="
echo ""
echo "🚀 Connecting SSH tunnel..."
echo "🌐 Open your browser to:"
echo ""
echo "   👉 http://localhost:${LOCAL_PORT}"
echo ""
echo "Press Ctrl+C at any time to close the tunnel."
echo ""

ssh -p "${PROD_SSH_PORT}" -N -L "${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}" "${PROD_SSH_HOST}"
