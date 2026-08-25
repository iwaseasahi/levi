#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${repository_root}/deploy/production/compose.yaml"
environment_file="${repository_root}/deploy/production/production.env.example"
project_name="levi-production-rehearsal"
application_image="${LEVI_IMAGE:-}"
migration_image="${LEVI_MIGRATION_IMAGE:-}"
synthetic_workload="${LEVI_RUN_SYNTHETIC_WORKLOAD:-false}"
backup_restore="${LEVI_RUN_BACKUP_RESTORE:-false}"
backup_root=""

if [[ -n "$application_image" || -n "$migration_image" ]]; then
  if [[ ! "$application_image" =~ ^[^[:space:]]+@sha256:[a-f0-9]{64}$ ]] ||
    [[ ! "$migration_image" =~ ^[^[:space:]]+@sha256:[a-f0-9]{64}$ ]]; then
    echo "Remote rehearsal requires digest-pinned LEVI_IMAGE and LEVI_MIGRATION_IMAGE." >&2
    exit 2
  fi
  readonly artifact_mode="remote"
else
  export LEVI_IMAGE="levi-production:rehearsal"
  export LEVI_MIGRATION_IMAGE="levi-migration:rehearsal"
  readonly artifact_mode="local"
fi
if [[ "$synthetic_workload" != "true" && "$synthetic_workload" != "false" ]]; then
  echo "LEVI_RUN_SYNTHETIC_WORKLOAD must be true or false." >&2
  exit 2
fi
if [[ "$backup_restore" != "true" && "$backup_restore" != "false" ]]; then
  echo "LEVI_RUN_BACKUP_RESTORE must be true or false." >&2
  exit 2
fi
if [[ "$backup_restore" == "true" && "$synthetic_workload" != "true" ]]; then
  echo "LEVI_RUN_BACKUP_RESTORE requires LEVI_RUN_SYNTHETIC_WORKLOAD=true." >&2
  exit 2
fi

compose() {
  docker compose \
    --project-name "${project_name}" \
    --env-file "${environment_file}" \
    --file "${compose_file}" \
    "$@"
}

cleanup() {
  compose down --volumes --remove-orphans --rmi local >/dev/null 2>&1 || true
  if [[ -n "$backup_root" && "$backup_root" == "${TMPDIR:-/tmp}/levi-production-rehearsal-backup."* ]]; then
    rm -rf -- "$backup_root"
  fi
}
trap cleanup EXIT

cleanup
if [[ "$artifact_mode" == "remote" ]]; then
  compose --profile migration pull app migrate
else
  compose --profile migration build app migrate
fi
compose up --detach --wait postgres
compose --profile migration run --rm migrate
compose up --detach --wait app

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

if [[ "$synthetic_workload" == "true" ]]; then
  compose --profile migration run --rm --no-deps \
    --entrypoint node \
    --env "LEVI_POC_ROUNDS=${LEVI_POC_ROUNDS:-20}" \
    --volume "${repository_root}/scripts/lib/production-workload.mjs:/app/production-workload.mjs:ro" \
    migrate /app/production-workload.mjs
  compose stats --no-stream
fi

if [[ "$backup_restore" == "true" ]]; then
  backup_root="$(mktemp -d "${TMPDIR:-/tmp}/levi-production-rehearsal-backup.XXXXXX")"
  readonly certificate_path="${backup_root}/recipient.crt"
  readonly private_key_path="${backup_root}/recipient.key"
  openssl req -x509 -newkey rsa:3072 -nodes -days 2 \
    -subj "/CN=Levi production rehearsal" \
    -keyout "$private_key_path" -out "$certificate_path" >/dev/null 2>&1
  chmod 600 "$private_key_path"

  export LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL=true
  export LEVI_BACKUP_CERTIFICATE="$certificate_path"
  export LEVI_BACKUP_PRIVATE_KEY="$private_key_path"
  export LEVI_BACKUP_ROOT="$backup_root"
  export LEVI_COMPOSE_FILE="$compose_file"
  export LEVI_COMPOSE_PROJECT_NAME="$project_name"
  export LEVI_DATABASE_NAME=levi
  export LEVI_DATABASE_SERVICE=postgres
  export LEVI_DATABASE_USER=levi_admin
  export LEVI_ENFORCE_RECOVERY_OBJECTIVES=true
  export LEVI_ENV_FILE="$environment_file"
  export LEVI_RESTORE_DATABASE=levi_restore_rehearsal

  source_sessions="$(compose exec --no-TTY postgres psql -At --no-psqlrc \
    -U levi_admin -d levi -c 'SELECT count(*) FROM sessions;')"
  source_sessions="${source_sessions//[[:space:]]/}"
  if [[ ! "$source_sessions" =~ ^[1-9][0-9]*$ ]]; then
    echo "Backup rehearsal requires at least one synthetic source session." >&2
    exit 1
  fi

  "${repository_root}/scripts/production-backup.sh" operational
  "${repository_root}/scripts/production-backup.sh" weekly
  archive_path="$(find "${backup_root}/weekly" -type f -name '*.tar.cms' -print -quit)"
  if [[ -z "$archive_path" ]]; then
    echo "Production rehearsal did not create an encrypted archive." >&2
    exit 1
  fi
  "${repository_root}/scripts/production-restore.sh" "$archive_path"
  "${repository_root}/scripts/check-production-backups.sh"

  restored_sessions="$(compose exec --no-TTY postgres psql -At --no-psqlrc \
    -U levi_admin -d levi_restore_rehearsal -c 'SELECT count(*) FROM sessions;')"
  restored_sessions="${restored_sessions//[[:space:]]/}"
  if [[ "$restored_sessions" != "0" ]]; then
    echo "Production rehearsal restored active sessions." >&2
    exit 1
  fi
  archive_bytes="$(stat -c %s "$archive_path" 2>/dev/null || stat -f %z "$archive_path")"
  echo "Encrypted backup and isolated restore rehearsal passed: archive_bytes=${archive_bytes} source_sessions=${source_sessions} restored_sessions=0"
fi

echo "Production application, migration, and least-privilege PostgreSQL rehearsal passed: artifact_mode=${artifact_mode}."
