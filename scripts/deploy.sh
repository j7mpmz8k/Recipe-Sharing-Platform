#!/usr/bin/env bash
# ==============================================================================
# deploy.sh - One-command update script for Recipe Sharing Platform
# ==============================================================================
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "==> Ensuring repository is on master branch..."
git checkout master

echo "==> Fetching latest changes from git on master..."
git pull origin master

echo "==> Building hardened container image..."
docker compose build --pull

echo "==> Deploying updated services..."
docker compose up -d --remove-orphans

echo "==> Cleaning up old unused images..."
docker image prune -f

echo "==> Application status:"
docker compose ps
