#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly rehearsal_id="$$"
readonly source_database="levi_backup_source_${rehearsal_id}"
readonly restore_database="levi_restore_rehearsal_${rehearsal_id}"
backup_root="$(mktemp -d "${TMPDIR:-/tmp}/levi-backup-rehearsal.XXXXXX")"
readonly certificate_path="${backup_root}/recipient.crt"
readonly private_key_path="${backup_root}/recipient.key"

cleanup() {
  docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
    dropdb --if-exists --force -U levi "$restore_database" >/dev/null 2>&1 || true
  docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
    dropdb --if-exists --force -U levi "$source_database" >/dev/null 2>&1 || true
  if [[ "$backup_root" == "${TMPDIR:-/tmp}/levi-backup-rehearsal."* ]]; then
    rm -rf -- "$backup_root"
  fi
}
trap cleanup EXIT

docker compose --file "${repository_root}/compose.development.yaml" up -d --wait postgres-test
docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
  createdb -U levi "$source_database"

export DATABASE_URL="postgresql://levi:levi@127.0.0.1:55433/${source_database}?schema=public"
export SHADOW_DATABASE_URL="postgresql://levi:levi@127.0.0.1:55433/levi_shadow?schema=public"
export NODE_ENV=test
pnpm db:migrate >/dev/null
pnpm db:seed >/dev/null

docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
  psql --no-psqlrc --set ON_ERROR_STOP=1 -U levi -d "$source_database" >/dev/null <<'SQL'
INSERT INTO users (id, name, email, email_verified, actor_state, must_change_password)
VALUES ('00000000-0000-4000-8000-000000000086', 'Restore rehearsal', 'restore-rehearsal@example.invalid', true, 'PENDING', false);
INSERT INTO sessions (id, user_id, token, expires_at)
VALUES ('00000000-0000-4000-8000-000000000186', '00000000-0000-4000-8000-000000000086', 'restore-rehearsal-session', now() + interval '30 days');
SQL

openssl req -x509 -newkey rsa:3072 -nodes -days 2 \
  -subj "/CN=Levi backup rehearsal" \
  -keyout "$private_key_path" -out "$certificate_path" >/dev/null 2>&1
chmod 600 "$private_key_path"

export LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL=true
export LEVI_BACKUP_ROOT="$backup_root"
export LEVI_BACKUP_CERTIFICATE="$certificate_path"
export LEVI_BACKUP_PRIVATE_KEY="$private_key_path"
export LEVI_COMPOSE_FILE="${repository_root}/compose.development.yaml"
export LEVI_ENV_FILE=""
export LEVI_DATABASE_SERVICE=postgres-test
export LEVI_DATABASE_NAME="$source_database"
export LEVI_DATABASE_USER=levi
export LEVI_RESTORE_DATABASE="$restore_database"
export LEVI_ENFORCE_RECOVERY_OBJECTIVES=true

started_epoch="$(date -u +%s)"
"${repository_root}/scripts/production-backup.sh" hourly
"${repository_root}/scripts/production-backup.sh" weekly
archive_path="$(find "${backup_root}/weekly" -type f -name '*.tar.cms' -print -quit)"
if [[ -z "$archive_path" ]]; then
  echo "Rehearsal did not create an encrypted weekly archive." >&2
  exit 1
fi

"${repository_root}/scripts/production-restore.sh" "$archive_path"
"${repository_root}/scripts/check-production-backups.sh"

source_sessions="$(docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
  psql -At --no-psqlrc -U levi -d "$source_database" -c 'SELECT count(*) FROM sessions;')"
restored_sessions="$(docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
  psql -At --no-psqlrc -U levi -d "$restore_database" -c 'SELECT count(*) FROM sessions;')"
if [[ "${source_sessions//[[:space:]]/}" != "1" || "${restored_sessions//[[:space:]]/}" != "0" ]]; then
  echo "Session invalidation rehearsal failed." >&2
  exit 1
fi

elapsed_seconds="$(( $(date -u +%s) - started_epoch ))"
if (( elapsed_seconds > 7200 )); then
  echo "Backup and restore rehearsal exceeded the 120-minute RTO." >&2
  exit 1
fi

echo "Encrypted backup rehearsal passed: rto_seconds=${elapsed_seconds} source_sessions=1 restored_sessions=0"
