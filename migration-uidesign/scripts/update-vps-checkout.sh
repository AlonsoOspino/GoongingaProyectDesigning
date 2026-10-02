#!/usr/bin/env bash
set -Eeuo pipefail

# Preserve host-specific proxy networks and aliases without discarding source edits.
cd "${GOON_PROJECT_DIR:-/opt/goonginga/migration-uidesign}"
branch="${1:-main}"
unexpected="$(git diff --name-only HEAD -- . ':(exclude)Caddyfile' ':(exclude)compose.yaml')"
if [[ -n "$unexpected" ]]; then
  echo "Tracked application edits on the VPS require review before pulling:" >&2
  printf '%s\n' "$unexpected" >&2
  exit 1
fi
umask 077
mkdir -p backups
saved_compose="backups/compose-before-pull-$(date -u +%Y%m%dT%H%M%SZ).yaml"
cp compose.yaml "$saved_compose"
stashed=0
if ! git diff --quiet HEAD -- Caddyfile compose.yaml; then
  git stash push -m 'vps-local-proxy-before-spring' -- Caddyfile compose.yaml
  stashed=1
fi
git pull --ff-only origin "$branch"
if [[ "$stashed" == 1 ]]; then
  git show 'stash@{0}:migration-uidesign/Caddyfile' > Caddyfile
fi
python3 - "$saved_compose" <<'PY'
import sys, yaml
with open(sys.argv[1]) as stream: previous = yaml.safe_load(stream)
with open('compose.yaml') as stream: current = yaml.safe_load(stream)
for name, service in previous.get('services', {}).items():
    if name in current['services'] and 'networks' in service:
        current['services'][name]['networks'] = service['networks']
if 'networks' in previous:
    current.setdefault('networks', {}).update(previous['networks'])
with open('compose.yaml', 'w') as stream:
    yaml.safe_dump(current, stream, sort_keys=False)
PY
docker compose config --quiet
echo "Checkout updated. Previous Compose saved at $saved_compose; proxy stash retained."
