#!/usr/bin/env bash
set -Eeuo pipefail

# --backend-only keeps the current frontend images.
cd "${GOON_PROJECT_DIR:-/opt/goonginga/migration-uidesign}"
case "${1:-}" in
  "") services=(backend frontend minigames) ;;
  --backend-only) services=(backend) ;;
  *) echo "Usage: $0 [--backend-only]" >&2; exit 2 ;;
esac
umask 077
mkdir -p backups media
set -a
source ./.env
set +a
deploy_id="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="backups/pre-spring-${deploy_id}.dump"
import_log="backups/import-${deploy_id}.log"
cutover_started=0
on_failure() {
  result=$?
  trap - ERR
  if [[ "$cutover_started" == 1 ]]; then
    docker compose stop backend || true
    echo "Cutover failed; backend stopped. Preserve $backup_file and review $import_log."
    echo "Recovery instructions: DEPLOYMENT.md. Do not run Node against Java writes."
  fi
  exit "$result"
}
trap on_failure ERR

echo "[1/7] Building images while the current API keeps serving..."
docker compose config --quiet
running_backend="$(docker compose ps -q backend)"
if [[ -n "$running_backend" ]]; then
  # Docker's containerd store reports a config digest on the container,
  # which cannot always be tagged. Preserve the named image before replacing it.
  previous_image="$(docker inspect --format '{{.Config.Image}}' "$running_backend")"
  docker tag "$previous_image" "goonginga-backend:rollback-${deploy_id}"
  printf '%s\n' "goonginga-backend:rollback-${deploy_id}" > "backups/previous-image-${deploy_id}.txt"
fi
cp compose.yaml "backups/compose-${deploy_id}.yaml"
docker compose build "${services[@]}"

echo "[2/7] Preparing shared media permissions..."
# Frontend owns existing files (UID 1000); Java uses group 10001.
docker run --rm --user 0 --network none --entrypoint sh \
  -v "$PWD/media:/media" postgres:18-bookworm -c \
  'chgrp -R 10001 /media; find /media -type d -exec chmod g+rws {} +; find /media -type f -exec chmod g+rw {} +'

echo "[3/7] Stopping API writes and taking a validated database backup..."
docker compose stop backend
cutover_started=1
docker compose exec -T database pg_dump -Fc --no-owner --no-privileges \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "${backup_file}.tmp"
test -s "${backup_file}.tmp"
docker compose exec -T database pg_restore --list < "${backup_file}.tmp" > /dev/null
mv "${backup_file}.tmp" "$backup_file"
echo "Backup: $backup_file"

echo "[4/7] Importing legacy drafts in one transaction..."
docker compose run --rm --no-deps backend --migration.mode=apply --server.port=0 \
  --draft.timeouts-enabled=false --feud.timeouts-enabled=false --notifications.enabled=false \
  > "$import_log" 2>&1
python3 - "$import_log" <<'PY'
import json, sys
reports = [json.loads(line.split(' ', 1)[1]) for line in open(sys.argv[1]) if line.startswith('LEGACY_DRAFT_IMPORTED ')]
assert len(reports) == 1, 'Importer did not finish'
report = reports[0]
assert report['blocked'] == 0 and report['ready'] == 0, 'Draft import incomplete'
print('Imported drafts:', report['alreadyMigrated'], '| Blocked:', report['blocked'])
PY

echo "[5/7] Starting Java and waiting for database health..."
docker compose up -d --no-deps backend
ready=0
for _attempt in $(seq 1 60); do
  if curl --fail --silent --max-time 3 http://127.0.0.1:3000/health | \
      python3 -c 'import json,sys; assert json.load(sys.stdin)["runtime"] == "spring-boot"' 2>/dev/null \
      && curl --fail --silent --max-time 3 http://127.0.0.1:3000/health/db > /dev/null; then
    ready=1
    break
  fi
  sleep 2
done
test "$ready" == 1
if [[ "${1:-}" != --backend-only ]]; then
  docker compose up -d --no-deps frontend minigames
fi

echo "[6/7] Checking public API, both frontends and Adara..."
curl --fail --silent --show-error --max-time 15 "https://${GOON_DOMAIN}/backend/health/db" > /dev/null
curl --fail --silent --show-error --max-time 15 "https://${GOON_DOMAIN}/backend/tournament/current" > /dev/null
curl --fail --silent --show-error --max-time 15 "https://${GOON_DOMAIN}/" > /dev/null
curl --fail --silent --show-error --max-time 15 "https://${GOON_GAMENIGHTS_DOMAIN}/feud" > /dev/null
curl --fail --silent --show-error --max-time 15 -D - -o /dev/null -X OPTIONS \
  "https://${GOON_DOMAIN}/backend/match" \
  -H "Origin: https://${GOON_GAMENIGHTS_DOMAIN}" \
  -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization' | \
  python3 -c 'import sys; origin=sys.argv[1]; headers=sys.stdin.read().lower(); assert "access-control-allow-origin: "+origin.lower() in headers' "https://${GOON_GAMENIGHTS_DOMAIN}"
if docker network inspect adara_proxy > /dev/null 2>&1; then
  curl --fail --silent --show-error --max-time 15 https://adara.pe/ > /dev/null
fi
cutover_started=0
trap - ERR

echo "[7/7] Deployment verified."
docker compose ps backend frontend minigames database
echo "Java is serving the API. Retain the backup and rollback image."
