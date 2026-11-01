#!/usr/bin/env bash
set -euo pipefail

echo "=============================================="
echo " Kapitl Production Deployment Pipeline"
echo "=============================================="

# 1. Pull latest code
echo "[1/4] Pulling latest production release..."
git pull origin main

# 2. Build containers
echo "[2/4] Building production containers..."
docker compose -f infra/docker/docker-compose.prod.yml build

# 3. Apply database migrations
echo "[3/4] Running Alembic database migrations..."
docker compose -f infra/docker/docker-compose.prod.yml run --rm api alembic upgrade head

# 4. Restart services with zero-downtime
echo "[4/4] Restarting services..."
docker compose -f infra/docker/docker-compose.prod.yml up -d --remove-orphans

echo "[SUCCESS] Kapitl production deployment complete."
