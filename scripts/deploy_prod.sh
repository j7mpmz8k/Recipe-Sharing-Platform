#!/usr/bin/env bash
# scripts/deploy_prod.sh
# Connects over SSH to trigger a clean deployment of the 'master' branch on production.
# Assumes you have already pushed and merged your changes into 'master' on GitHub.

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

PROD_SSH_HOST="${PROD_SSH_HOST:-$1}"
PROD_SSH_PORT="${PROD_SSH_PORT:-48222}"

if [ -z "$PROD_SSH_HOST" ]; then
    echo "[Error] PROD_SSH_HOST is not configured in .env. Aborted."
    exit 1
fi

DEPLOY_BRANCH="master"

echo "=================================================="
echo "   Recipe Sharing Platform - Production Deploy    "
echo "=================================================="
echo "  Target Server:    ${PROD_SSH_HOST}:${PROD_SSH_PORT}"
echo "  Target Branch:    ${DEPLOY_BRANCH}"
echo "  Action:           Pull & deploy merged '${DEPLOY_BRANCH}' (no local push)"
echo ""

read -rp "🚀 Deploy latest '${DEPLOY_BRANCH}' to production? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Deployment canceled by user."
    exit 0
fi

echo ""
echo "==> Connecting to production server to deploy '${DEPLOY_BRANCH}'..."
ssh -p "${PROD_SSH_PORT}" "${PROD_SSH_HOST}" '
    set -eo pipefail
    cd ~/docker_services/recipe-sharing-platform

    echo "==> Ensuring repository is on master branch..."
    git checkout master

    echo "==> Pulling latest merged master changes..."
    git pull origin master

    echo "==> Building container image..."
    docker compose build --pull

    echo "==> Starting updated services..."
    docker compose up -d --remove-orphans

    echo "==> Cleaning up unused images..."
    docker image prune -f

    echo "==> Production services status:"
    docker compose ps
'

echo ""
echo "✓ Production deployment of master completed successfully!"
