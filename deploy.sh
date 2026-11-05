#!/usr/bin/env bash
# ==============================================================================
# deploy.sh - One-command update script for Recipe Sharing Platform
# ==============================================================================
set -eo pipefail

echo "==> Fetching latest changes from git..."
git pull origin main

echo "==> Building hardened container image..."
docker compose build --pull

echo "==> Deploying updated services..."
docker compose up -d --remove-orphans

echo "==> Cleaning up old unused images..."
docker image prune -f

echo "==> Application status:"
docker compose ps
