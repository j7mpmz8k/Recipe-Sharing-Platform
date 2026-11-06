#!/usr/bin/env bash
# scripts/down_prod.sh
# Connects over SSH to run 'docker compose down' on the production server.

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

AUTO_CONFIRM=false
for arg in "$@"; do
    case "$arg" in
        -y|--yes|-f|--force)
            AUTO_CONFIRM=true
            ;;
        *)
            if [[ "$arg" != -* ]]; then
                PROD_SSH_HOST="$arg"
            fi
            ;;
    esac
done

PROD_SSH_PORT="${PROD_SSH_PORT:-48222}"

if [ -z "$PROD_SSH_HOST" ]; then
    echo "[Error] PROD_SSH_HOST is not configured in .env. Aborted."
    exit 1
fi

echo "=================================================="
echo "   Recipe Sharing Platform - Production Down      "
echo "=================================================="
echo "  Target Server: ${PROD_SSH_HOST}:${PROD_SSH_PORT}"
echo "  Action:        docker compose down"
echo ""

if [ "$AUTO_CONFIRM" != "true" ]; then
    read -rp "🛑 Take down production Docker containers? [y/N]: " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo "Aborted by user."
        exit 0
    fi
fi

echo ""
echo "==> Taking down production containers..."
ssh -p "${PROD_SSH_PORT}" "${PROD_SSH_HOST}" 'bash -s' << 'EOF'
    set -eo pipefail
    cd ~/docker_services/recipe-sharing-platform
    docker compose down
    echo ""
    echo "==> Production services status:"
    docker compose ps
EOF

echo ""
echo "✓ Production containers have been taken down successfully!"
echo "💡 To bring them back online anytime, run: npm run prod:start"
