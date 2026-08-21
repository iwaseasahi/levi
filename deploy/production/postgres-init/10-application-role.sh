#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${LEVI_APP_DATABASE_PASSWORD:-}" ]]; then
  echo "LEVI_APP_DATABASE_PASSWORD is required for initial database bootstrap." >&2
  exit 1
fi

psql --no-psqlrc --set ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set admin_user="$POSTGRES_USER" \
  --set app_password="$LEVI_APP_DATABASE_PASSWORD" \
  --set database_name="$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE levi_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'levi_app')
\gexec

GRANT CONNECT ON DATABASE :"database_name" TO levi_app;
GRANT USAGE ON SCHEMA public TO levi_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :"admin_user" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO levi_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :"admin_user" IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO levi_app;
SQL
