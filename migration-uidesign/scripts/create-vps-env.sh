#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <public-ip-or-hostname>" >&2
  exit 1
fi

public_host="$1"
for env_file in .env backend/.env frontend/.env; do
  if [[ -e "$env_file" ]]; then
    echo "Refusing to overwrite $env_file. Move it aside first if it is only a template." >&2
    exit 1
  fi
done

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate secure secrets." >&2
  exit 1
fi

umask 077
postgres_password="$(openssl rand -hex 32)"
jwt_secret="$(openssl rand -hex 48)"
draft_key="$(openssl rand -hex 32)"
admin_bootstrap_password="$(openssl rand -hex 32)"

cat > .env <<EOF
NEXT_PUBLIC_API_BASE_URL=http://${public_host}:3000
POSTGRES_DB=goonginga
POSTGRES_USER=goonginga
POSTGRES_PASSWORD=${postgres_password}
GOON_API_BIND_ADDRESS=0.0.0.0
GOON_API_PORT=3000
GOON_FRONTEND_BIND_ADDRESS=0.0.0.0
GOON_FRONTEND_PORT=3001
EOF

cat > backend/.env <<EOF
DATABASE_URL=postgresql://goonginga:${postgres_password}@database:5432/goonginga?schema=public
DIRECT_URL=postgresql://goonginga:${postgres_password}@database:5432/goonginga?schema=public
JWT_SECRET=${jwt_secret}
DRAFT_TABLE_MANAGER_KEY=${draft_key}
ADMIN_BOOTSTRAP_PASSWORD=${admin_bootstrap_password}
CORS_ORIGIN=http://${public_host}:3001
EOF

cat > frontend/.env <<EOF
NEXT_PUBLIC_API_BASE_URL=http://${public_host}:3000
# Add a newly created Vercel Blob token here before enabling new image uploads.
# BLOB_READ_WRITE_TOKEN=
EOF

chmod 600 .env backend/.env frontend/.env
echo "Created fresh .env, backend/.env, and frontend/.env with restrictive permissions."
