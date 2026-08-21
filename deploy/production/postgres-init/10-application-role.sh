#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${LEVI_APP_DATABASE_PASSWORD:-}" ]]; then
  echo "LEVI_APP_DATABASE_PASSWORD is required for initial database bootstrap." >&2
  exit 1
fi
if [[ ! "$POSTGRES_DB" =~ ^[a-z][a-z0-9_]*$ ]]; then
  echo "POSTGRES_DB must be a safe lowercase PostgreSQL identifier." >&2
  exit 1
fi

shadow_database="${POSTGRES_DB}_shadow"
if ! psql --no-psqlrc --tuples-only --no-align \
  --username "$POSTGRES_USER" --dbname postgres \
  --command "SELECT 1 FROM pg_database WHERE datname = '${shadow_database}';" | grep -qx 1; then
  createdb --username "$POSTGRES_USER" "$shadow_database"
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
