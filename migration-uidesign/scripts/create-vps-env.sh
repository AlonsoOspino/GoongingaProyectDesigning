#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <main-public-domain> <minigames-public-domain>" >&2
  exit 1
fi

public_domain="$1"
minigames_domain="$2"
for env_file in .env backend/.env frontend/.env; do
  if [[ -e "$env_file" ]]; then
    echo "Refusing to overwrite $env_file. Move it aside first if it is only a template." >&2
    exit 1
  fi
done

mkdir -p media

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate secure secrets." >&2
  exit 1
fi

umask 077
postgres_password="$(openssl rand -hex 32)"
jwt_secret="$(openssl rand -hex 48)"
draft_key="$(openssl rand -hex 32)"
admin_bootstrap_password="$(openssl rand -hex 32)"
network_jwt_secret="$(openssl rand -hex 48)"

cat > .env <<EOF
GOON_DOMAIN=${public_domain}
GOON_GAMENIGHTS_DOMAIN=${minigames_domain}
NEXT_PUBLIC_API_BASE_URL=https://${public_domain}/backend
NEXT_PUBLIC_MINIGAMES_API_BASE_URL=https://${public_domain}/backend
POSTGRES_DB=goonginga
POSTGRES_USER=goonginga
POSTGRES_PASSWORD=${postgres_password}
GOON_API_BIND_ADDRESS=127.0.0.1
GOON_API_PORT=3000
GOON_FRONTEND_BIND_ADDRESS=127.0.0.1
GOON_FRONTEND_PORT=3001
EOF

cat > backend/.env <<EOF
DATABASE_URL=postgresql://goonginga:${postgres_password}@database:5432/goonginga?schema=public
DIRECT_URL=postgresql://goonginga:${postgres_password}@database:5432/goonginga?schema=public
JWT_SECRET=${jwt_secret}
DRAFT_TABLE_MANAGER_KEY=${draft_key}
ADMIN_BOOTSTRAP_PASSWORD=${admin_bootstrap_password}
CORS_ORIGIN=https://${public_domain},https://${minigames_domain}
MEDIA_DIR=/app/uploads
NETWORK_AUTH_PUBLIC_PATH_PREFIX=/backend
NETWORK_FRONTEND_URL=https://${public_domain}
NETWORK_MINIGAMES_FRONTEND_URL=https://${minigames_domain}
NETWORK_JWT_SECRET=${network_jwt_secret}
EOF

cat > frontend/.env <<EOF
NEXT_PUBLIC_API_BASE_URL=https://${public_domain}/backend
MEDIA_DIR=/app/uploads
EOF

chmod 600 .env backend/.env frontend/.env
echo "Created fresh .env, backend/.env, and frontend/.env with restrictive permissions."
