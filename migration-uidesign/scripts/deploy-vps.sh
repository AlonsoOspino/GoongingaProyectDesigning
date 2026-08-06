#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="/opt/goonginga/migration-uidesign"
cd "$PROJECT_DIR"

echo "[VPS 1/5] Creating a database backup..."
mkdir -p backups
set -a
# shellcheck disable=SC1091
source ./.env
set +a
backup_file="backups/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T database pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$backup_file"
test -s "$backup_file"
echo "Backup created: $backup_file"

echo "[VPS 2/5] Building backend and frontend images..."
docker compose build backend frontend

echo "[VPS 3/5] Starting the new backend and frontend..."
docker compose up -d --no-deps backend frontend

echo "[VPS 4/5] Waiting for both services..."
backend_ready=0
frontend_ready=0
for _attempt in $(seq 1 45); do
  if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3000/tournament/current >/dev/null; then
    backend_ready=1
  fi
  if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3001/ >/dev/null; then
    frontend_ready=1
  fi
  if [[ "$backend_ready" == "1" && "$frontend_ready" == "1" ]]; then
    break
  fi
  sleep 2
done

if [[ "$backend_ready" != "1" || "$frontend_ready" != "1" ]]; then
  echo "Deployment health check failed. Recent logs:"
  docker compose logs --tail=120 backend frontend
  exit 1
fi

echo "[VPS 5/5] Verifying public routes..."
curl --fail --silent --show-error --max-time 15 https://goongingaleague.duckdns.org/ >/dev/null
curl --fail --silent --show-error --max-time 15 https://goongingaleague.duckdns.org/backend/tournament/current >/dev/null
curl --fail --silent --show-error --max-time 15 https://goongingaleague.duckdns.org/finals >/dev/null
curl --fail --silent --show-error --max-time 15 https://adara.pe/ >/dev/null

docker compose ps backend frontend database
echo "Deployment successful. Goonginga and Adara are responding."
