#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly reconciliation_sql="${repository_root}/scripts/lib/backup-reconciliation.sql"
readonly backup_tier="${1:-}"
readonly compose_file="${LEVI_COMPOSE_FILE:-/opt/levi/deploy/production/compose.yaml}"
readonly compose_project_name="${LEVI_COMPOSE_PROJECT_NAME:-}"
readonly environment_file="${LEVI_ENV_FILE-/etc/levi/production.env}"
readonly backup_root="${LEVI_BACKUP_ROOT:-/var/backups/levi}"
readonly backup_certificate="${LEVI_BACKUP_CERTIFICATE:-/etc/levi/backup-recipient.crt}"
readonly database_service="${LEVI_DATABASE_SERVICE:-postgres}"
readonly database_name="${LEVI_DATABASE_NAME:-levi}"
readonly database_user="${LEVI_DATABASE_USER:-levi_admin}"
readonly capacity_limit="${LEVI_BACKUP_CAPACITY_PERCENT:-80}"

if [[ "$backup_tier" != "hourly" && "$backup_tier" != "daily" ]]; then
  echo "Usage: production-backup.sh hourly|daily" >&2
  exit 2
fi
if [[ "${EUID}" -ne 0 && "${LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL:-false}" != "true" ]]; then
  echo "Production backups must run as root." >&2
  exit 2
fi
if [[ ! -r "$backup_certificate" ]]; then
  echo "Backup recipient certificate is not readable: $backup_certificate" >&2
  exit 2
fi

compose() {
  local -a arguments=(--file "$compose_file")
  if [[ -n "$compose_project_name" ]]; then
    arguments=(--project-name "$compose_project_name" "${arguments[@]}")
  fi
  if [[ -n "$environment_file" ]]; then
    arguments=(--env-file "$environment_file" "${arguments[@]}")
  fi
  docker compose "${arguments[@]}" "$@"
}

prepare_directory() {
  local directory="$1"
  mkdir -p "$directory"
  chmod 700 "$directory"
}

prepare_directory "$backup_root"
prepare_directory "${backup_root}/hourly"
prepare_directory "${backup_root}/daily"
prepare_directory "${backup_root}/restore-proofs"

readonly lock_directory="${backup_root}/.backup.lock"
if ! mkdir "$lock_directory" 2>/dev/null; then
  echo "Another Levi backup is already running." >&2
  exit 1
fi

work_directory="$(mktemp -d "${backup_root}/.backup-work.XXXXXX")"
cleanup() {
  if [[ "$work_directory" == "${backup_root}/.backup-work."* ]]; then
    rm -rf -- "$work_directory"
  fi
  rmdir "$lock_directory" 2>/dev/null || true
}
trap cleanup EXIT

readonly created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
readonly created_epoch="$(date -u +%s)"
readonly timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
readonly archive_name="levi-${backup_tier}-${timestamp}.tar.cms"
readonly archive_path="${backup_root}/${backup_tier}/${archive_name}"
readonly temporary_archive="${work_directory}/${archive_name}"
readonly dump_path="${work_directory}/database.dump"
readonly manifest_path="${work_directory}/manifest.env"

compose exec -T "$database_service" pg_dump \
  --format=custom \
  --no-owner \
  --username "$database_user" \
  --dbname "$database_name" >"$dump_path"
compose exec -T "$database_service" pg_restore --list <"$dump_path" >/dev/null

signature="$(compose exec -T "$database_service" psql \
  --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --username "$database_user" --dbname "$database_name" <"$reconciliation_sql")"
signature="${signature//$'\r'/}"
signature="${signature//$'\n'/}"

{
  printf 'format=levi-backup-v1\n'
  printf 'created_at=%s\n' "$created_at"
  printf 'created_epoch=%s\n' "$created_epoch"
  printf 'tier=%s\n' "$backup_tier"
  printf 'database=%s\n' "$database_name"
  printf 'signature=%s\n' "$signature"
} >"$manifest_path"

tar -C "$work_directory" -cf - database.dump manifest.env | \
  openssl cms -encrypt -binary -outform DER -aes-256-gcm \
    -recip "$backup_certificate" -keyopt rsa_padding_mode:oaep \
    -out "$temporary_archive"
chmod 600 "$temporary_archive"
mv "$temporary_archive" "$archive_path"

archive_hash="$(openssl dgst -sha256 -r "$archive_path" | awk '{print $1}')"
printf '%s  %s\n' "$archive_hash" "$archive_name" >"${archive_path}.sha256"
chmod 600 "$archive_path" "${archive_path}.sha256"

find "${backup_root}/hourly" -type f -mmin +2880 -delete
find "${backup_root}/daily" -type f -mmin +20160 -delete

capacity_used="$(df -Pk "$backup_root" | awk 'NR == 2 {gsub("%", "", $5); print $5}')"
if [[ ! "$capacity_used" =~ ^[0-9]+$ ]] || (( capacity_used >= capacity_limit )); then
  echo "Backup completed, but backup filesystem usage is ${capacity_used:-unknown}% (limit ${capacity_limit}%)." >&2
  exit 1
fi

{
  printf 'created_at=%s\n' "$created_at"
  printf 'created_epoch=%s\n' "$created_epoch"
  printf 'tier=%s\n' "$backup_tier"
  printf 'archive=%s\n' "$archive_path"
  printf 'sha256=%s\n' "$archive_hash"
  printf 'capacity_percent=%s\n' "$capacity_used"
} >"${backup_root}/last-${backup_tier}-success.env"
chmod 600 "${backup_root}/last-${backup_tier}-success.env"

echo "Encrypted ${backup_tier} backup completed: archive=${archive_path} sha256=${archive_hash}"
