#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly reconciliation_sql="${repository_root}/scripts/lib/backup-reconciliation.sql"
readonly archive_path="${1:-}"
readonly compose_file="${LEVI_COMPOSE_FILE:-/opt/levi/deploy/production/compose.yaml}"
readonly environment_file="${LEVI_ENV_FILE-/etc/levi/production.env}"
readonly backup_root="${LEVI_BACKUP_ROOT:-/var/backups/levi}"
readonly backup_certificate="${LEVI_BACKUP_CERTIFICATE:-/etc/levi/backup-recipient.crt}"
readonly backup_private_key="${LEVI_BACKUP_PRIVATE_KEY:-}"
readonly database_service="${LEVI_DATABASE_SERVICE:-postgres}"
readonly database_user="${LEVI_DATABASE_USER:-levi_admin}"

if [[ -z "$archive_path" ]]; then
  echo "Usage: production-restore.sh /var/backups/levi/hourly|daily/<archive>.tar.cms" >&2
  exit 2
fi
if [[ "${EUID}" -ne 0 && "${LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL:-false}" != "true" ]]; then
  echo "Production restores must run as root." >&2
  exit 2
fi
if [[ -z "$backup_private_key" || ! -r "$backup_private_key" ]]; then
  echo "LEVI_BACKUP_PRIVATE_KEY must reference the approved, readable recovery key." >&2
  exit 2
fi
if [[ ! -r "$backup_certificate" || ! -r "$archive_path" ]]; then
  echo "Backup certificate or archive is not readable." >&2
  exit 2
fi

backup_root_real="$(cd "$backup_root" && pwd -P)"
archive_directory_real="$(cd "$(dirname "$archive_path")" && pwd -P)"
archive_real="${archive_directory_real}/$(basename "$archive_path")"
case "$archive_real" in
  "${backup_root_real}/hourly/"*.tar.cms | "${backup_root_real}/daily/"*.tar.cms) ;;
  *)
    echo "Archive must be an hourly or daily file below LEVI_BACKUP_ROOT." >&2
    exit 2
    ;;
esac

compose() {
  local -a arguments=(--file "$compose_file")
  if [[ -n "$environment_file" ]]; then
    arguments=(--env-file "$environment_file" "${arguments[@]}")
  fi
  docker compose "${arguments[@]}" "$@"
}

readonly restore_started_epoch="$(date -u +%s)"
readonly restore_timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
readonly restore_suffix="$(printf '%s' "$restore_timestamp" | tr '[:upper:]' '[:lower:]')"
readonly restore_database="${LEVI_RESTORE_DATABASE:-levi_restore_${restore_suffix}}"
if [[ ! "$restore_database" =~ ^levi_restore_[a-z0-9_]+$ ]]; then
  echo "LEVI_RESTORE_DATABASE must start with levi_restore_ and contain lowercase letters, numbers, or underscores." >&2
  exit 2
fi

work_directory="$(mktemp -d "${backup_root}/.restore-work.XXXXXX")"
restore_complete=false
cleanup() {
  if [[ "$restore_complete" != "true" ]]; then
    compose exec -T "$database_service" dropdb --if-exists --force \
      --username "$database_user" "$restore_database" >/dev/null 2>&1 || true
  fi
  if [[ "$work_directory" == "${backup_root}/.restore-work."* ]]; then
    rm -rf -- "$work_directory"
  fi
}
trap cleanup EXIT

expected_hash_file="${archive_real}.sha256"
if [[ ! -r "$expected_hash_file" ]]; then
  echo "Archive checksum is missing: $expected_hash_file" >&2
  exit 1
fi
expected_hash="$(awk 'NR == 1 {print $1}' "$expected_hash_file")"
actual_hash="$(openssl dgst -sha256 -r "$archive_real" | awk '{print $1}')"
if [[ ! "$expected_hash" =~ ^[a-f0-9]{64}$ || "$actual_hash" != "$expected_hash" ]]; then
  echo "Encrypted archive checksum verification failed." >&2
  exit 1
fi

readonly decrypted_tar="${work_directory}/archive.tar"
openssl cms -decrypt -binary -inform DER \
  -recip "$backup_certificate" -inkey "$backup_private_key" \
  -in "$archive_real" -out "$decrypted_tar"
archive_members="$(tar -tf "$decrypted_tar" | LC_ALL=C sort)"
if [[ "$archive_members" != $'database.dump\nmanifest.env' ]]; then
  echo "Decrypted backup contains unexpected archive members." >&2
  exit 1
fi
tar -C "$work_directory" -xf "$decrypted_tar" -- database.dump manifest.env

readonly dump_path="${work_directory}/database.dump"
readonly manifest_path="${work_directory}/manifest.env"
if [[ ! -f "$dump_path" || ! -f "$manifest_path" ]]; then
  echo "Decrypted backup does not contain the expected files." >&2
  exit 1
fi
if [[ "$(awk -F= '$1 == "format" {print $2}' "$manifest_path")" != "levi-backup-v1" ]]; then
  echo "Unsupported backup manifest format." >&2
  exit 1
fi
expected_signature="$(awk -F= '$1 == "signature" {sub(/^[^=]*=/, ""); print}' "$manifest_path")"
created_epoch="$(awk -F= '$1 == "created_epoch" {print $2}' "$manifest_path")"
if [[ -z "$expected_signature" || ! "$created_epoch" =~ ^[0-9]+$ ]]; then
  echo "Backup manifest is incomplete." >&2
  exit 1
fi

compose exec -T "$database_service" pg_restore --list <"$dump_path" >/dev/null
compose exec -T "$database_service" dropdb --if-exists --force \
  --username "$database_user" "$restore_database"
compose exec -T "$database_service" createdb \
  --username "$database_user" "$restore_database"
compose exec -T "$database_service" pg_restore \
  --exit-on-error --no-owner --username "$database_user" \
  --dbname "$restore_database" <"$dump_path"

restored_signature="$(compose exec -T "$database_service" psql \
  --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --username "$database_user" --dbname "$restore_database" <"$reconciliation_sql")"
restored_signature="${restored_signature//$'\r'/}"
restored_signature="${restored_signature//$'\n'/}"
if [[ "$restored_signature" != "$expected_signature" ]]; then
  echo "Restored database reconciliation failed." >&2
  exit 1
fi

compose exec -T "$database_service" psql \
  --no-psqlrc --set ON_ERROR_STOP=1 --username "$database_user" \
  --dbname "$restore_database" --command "DELETE FROM sessions;" >/dev/null
remaining_sessions="$(compose exec -T "$database_service" psql \
  --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --username "$database_user" --dbname "$restore_database" \
  --command "SELECT count(*) FROM sessions;")"
remaining_sessions="${remaining_sessions//[[:space:]]/}"
if [[ "$remaining_sessions" != "0" ]]; then
  echo "Restored sessions were not fully invalidated." >&2
  exit 1
fi

restore_finished_epoch="$(date -u +%s)"
recovery_point_age_seconds="$((restore_started_epoch - created_epoch))"
restore_duration_seconds="$((restore_finished_epoch - restore_started_epoch))"
if (( recovery_point_age_seconds > 3600 || restore_duration_seconds > 7200 )); then
  echo "Restore verification missed the measured objectives: age=${recovery_point_age_seconds}s duration=${restore_duration_seconds}s" >&2
  if [[ "${LEVI_ENFORCE_RECOVERY_OBJECTIVES:-false}" == "true" ]]; then
    exit 1
  fi
fi

proof_path="${backup_root}/restore-proofs/${restore_timestamp}.env"
{
  printf 'verified_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'archive=%s\n' "$archive_real"
  printf 'archive_sha256=%s\n' "$actual_hash"
  printf 'restore_database=%s\n' "$restore_database"
  printf 'sessions_remaining=0\n'
  printf 'recovery_point_age_seconds=%s\n' "$recovery_point_age_seconds"
  printf 'restore_duration_seconds=%s\n' "$restore_duration_seconds"
} >"$proof_path"
chmod 600 "$proof_path"
cp "$proof_path" "${backup_root}/restore-proofs/latest.env"
chmod 600 "${backup_root}/restore-proofs/latest.env"

restore_complete=true
echo "Isolated restore verified: database=${restore_database} rpo_age_seconds=${recovery_point_age_seconds} rto_seconds=${restore_duration_seconds} sessions=0"
echo "Traffic has not been switched. Promotion requires immediate human approval and production-promote-restore.sh."
