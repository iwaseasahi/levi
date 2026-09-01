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

docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
  psql --no-psqlrc --set ON_ERROR_STOP=1 -U levi -d "$source_database" \
  <"${repository_root}/scripts/lib/rehearsal-slide-fixture.sql" >/dev/null

# Exercise the immutable expand migration against populated unrelated tables.
# DDL is inside a transaction rolled back in this disposable database only.
{
  cat <<'SQL'
BEGIN;
CREATE TEMP TABLE before_expansion AS
SELECT jsonb_build_object(
 'bible', (SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM bible_verses v),
 'folders', (SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM folders f),
 'bookmarks', (SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookmarks b),
 'scripture', (SELECT jsonb_agg(to_jsonb(s) ORDER BY bookmark_id) FROM scripture_bookmarks s)
) AS snapshot;
DROP TABLE slide_bookmarks;
DROP TABLE slides;
SQL
  cat "${repository_root}/scripts/lib/backup-slide-reconciliation.sql"
  cat "${repository_root}/prisma/migrations/20260831050000_church_owned_slides/migration.sql"
  cat <<'SQL'
DO $$ BEGIN
 IF (SELECT snapshot FROM before_expansion) IS DISTINCT FROM jsonb_build_object(
 'bible', (SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM bible_verses v),
 'folders', (SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM folders f),
 'bookmarks', (SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookmarks b),
 'scripture', (SELECT jsonb_agg(to_jsonb(s) ORDER BY bookmark_id) FROM scripture_bookmarks s)
 ) THEN RAISE EXCEPTION 'Slide expansion changed existing aggregates'; END IF;
END $$;
ROLLBACK;
SQL
} | docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
  psql --no-psqlrc --set ON_ERROR_STOP=1 -U levi -d "$source_database" >/dev/null

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
"${repository_root}/scripts/production-backup.sh" operational
"${repository_root}/scripts/production-backup.sh" weekly
archive_path="$(find "${backup_root}/weekly" -type f -name '*.tar.cms' -print -quit)"
if [[ -z "$archive_path" ]]; then
  echo "Rehearsal did not create an encrypted weekly archive." >&2
  exit 1
fi

# Source deletions happen AFTER the archive. An isolated restore must initially
# reconcile the archived rows, then reapply the reviewed deletion set before use.
docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
  psql --no-psqlrc --set ON_ERROR_STOP=1 -U levi -d "$source_database" \
  <"${repository_root}/scripts/lib/rehearsal-slide-deletions.sql" >/dev/null

"${repository_root}/scripts/production-restore.sh" "$archive_path"
docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
  psql --no-psqlrc --set ON_ERROR_STOP=1 -U levi -d "$restore_database" \
  <"${repository_root}/scripts/lib/rehearsal-slide-deletions.sql" >/dev/null
for database in "$source_database" "$restore_database"; do
  docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
    psql -At --no-psqlrc --set ON_ERROR_STOP=1 -U levi -d "$database" \
    <"${repository_root}/scripts/lib/backup-slide-reconciliation.sql" >"${backup_root}/${database}.signature"
done
if ! cmp -s "${backup_root}/${source_database}.signature" "${backup_root}/${restore_database}.signature"; then
  echo "Post-deletion Slide reconciliation failed." >&2
  exit 1
fi
"${repository_root}/scripts/check-production-backups.sh"

source_sessions="$(docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
  psql -At --no-psqlrc -U levi -d "$source_database" -c 'SELECT count(*) FROM sessions;')"
restored_sessions="$(docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
  psql -At --no-psqlrc -U levi -d "$restore_database" <"${repository_root}/scripts/lib/restored-session-count.sql")"
if [[ "${source_sessions//[[:space:]]/}" != "1" || "${restored_sessions//[[:space:]]/}" != "0" ]]; then
  echo "Session invalidation rehearsal failed." >&2
  exit 1
fi

# Re-encrypt synthetic manifests to exercise v1 compatibility and a corrupt v2
# Slide signature. Never print decrypted contents or keys to artifacts.
mkdir -m 700 "${backup_root}/compat"
openssl cms -decrypt -binary -inform DER -recip "$certificate_path" \
  -inkey "$private_key_path" -in "$archive_path" -out "${backup_root}/compat/archive.tar"
tar -C "${backup_root}/compat" -xf "${backup_root}/compat/archive.tar" -- database.dump manifest.env
cp "${backup_root}/compat/manifest.env" "${backup_root}/compat/original.env"
for variant in invalid legacy; do
  if [[ "$variant" == "invalid" ]]; then
    sed 's/^slide_signature=.*/slide_signature=0:00000000000000000000000000000000/' \
      "${backup_root}/compat/original.env" >"${backup_root}/compat/manifest.env"
  else
    sed -e 's/^format=levi-backup-v2$/format=levi-backup-v1/' -e '/^slide_signature=/d' \
      "${backup_root}/compat/original.env" >"${backup_root}/compat/manifest.env"
  fi
  variant_archive="${backup_root}/weekly/rehearsal-${variant}.tar.cms"
  tar -C "${backup_root}/compat" -cf - database.dump manifest.env | \
    openssl cms -encrypt -binary -outform DER -aes-256-gcm \
      -recip "$certificate_path" -keyopt rsa_padding_mode:oaep -out "$variant_archive"
  openssl dgst -sha256 -r "$variant_archive" >"${variant_archive}.sha256"
  if [[ "$variant" == "invalid" ]]; then
    if "${repository_root}/scripts/production-restore.sh" "$variant_archive" >"${backup_root}/invalid-result.log" 2>&1; then
      echo "Corrupt Slide signature was incorrectly accepted." >&2
      exit 1
    fi
    if ! grep -q 'Restored Slide reconciliation failed' "${backup_root}/invalid-result.log"; then
      echo "Corrupt signature failed for an unexpected reason." >&2
      exit 1
    fi
  else
    "${repository_root}/scripts/production-restore.sh" "$variant_archive"
    docker compose --file "${repository_root}/compose.development.yaml" exec -T postgres-test \
      psql --no-psqlrc --set ON_ERROR_STOP=1 -U levi -d "$restore_database" \
      <"${repository_root}/scripts/lib/rehearsal-slide-deletions.sql" >/dev/null
  fi
done

elapsed_seconds="$(( $(date -u +%s) - started_epoch ))"
if (( elapsed_seconds > 7200 )); then
  echo "Backup and restore rehearsal exceeded the 120-minute RTO." >&2
  exit 1
fi

echo "Encrypted backup rehearsal passed: rto_seconds=${elapsed_seconds} source_sessions=1 restored_sessions=0 slides_reconciled=true"
