#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${repository_root}/deploy/production/compose.yaml"
environment_file="${repository_root}/deploy/production/production.env.example"
project_name="levi-production-rehearsal"
export LEVI_IMAGE="levi-production:rehearsal"

compose() {
  docker compose \
    --project-name "${project_name}" \
    --env-file "${environment_file}" \
    --file "${compose_file}" \
    "$@"
}

cleanup() {
  compose down --volumes --remove-orphans --rmi local >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
compose --profile migration build app migrate
compose up --detach --wait postgres app
compose --profile migration run --rm migrate

compose exec --no-TTY app node -e \
  "if(process.getuid?.()!==1000)throw new Error('app is not running as uid 1000')"
compose exec --no-TTY app node -e \
  "require('node:fs').writeFileSync('/tmp/levi-read-write-probe','ok')"
if compose exec --no-TTY app node -e \
  "require('node:fs').writeFileSync('/levi-read-only-probe','unexpected')" \
  >/dev/null 2>&1; then
  echo "Application root filesystem was writable." >&2
  exit 1
fi
compose exec --no-TTY app node -e \
  "fetch('http://127.0.0.1:3000/api/ready').then(async response=>{if(!response.ok)throw new Error(await response.text());console.log(await response.text())})"
application_role_flags="$(compose exec --no-TTY postgres psql \
  -At --no-psqlrc -U levi_admin -d levi \
  -c "SELECT rolsuper::text || ':' || rolcreatedb::text || ':' || rolcreaterole::text FROM pg_roles WHERE rolname = 'levi_app';")"
application_role_flags="${application_role_flags//[[:space:]]/}"
if [[ "$application_role_flags" != "false:false:false" ]]; then
  echo "Application database role has elevated privileges: ${application_role_flags}" >&2
  exit 1
fi
application_table_access="$(compose exec --no-TTY postgres psql \
  -At --no-psqlrc -U levi_admin -d levi \
  -c "SET ROLE levi_app; SELECT count(*) FROM users;")"
application_table_access="${application_table_access//[[:space:]]/}"
if [[ "$application_table_access" != "SET0" ]]; then
  echo "Application database role cannot read migrated tables: ${application_table_access}" >&2
  exit 1
fi

echo "Production application, migration, and least-privilege PostgreSQL rehearsal passed."
