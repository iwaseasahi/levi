#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly restore_database="${LEVI_RESTORE_DATABASE:-}"
readonly approval_reference="${LEVI_RESTORE_APPROVAL_REFERENCE:-}"
readonly compose_file="${LEVI_COMPOSE_FILE:-/opt/levi/deploy/production/compose.yaml}"
readonly environment_file="${LEVI_ENV_FILE:-/etc/levi/production.env}"
readonly backup_root="${LEVI_BACKUP_ROOT:-/var/backups/levi}"
readonly restore_proof="${LEVI_RESTORE_PROOF:-${backup_root}/restore-proofs/latest.env}"
readonly database_service="${LEVI_DATABASE_SERVICE:-postgres}"
readonly database_user="${LEVI_DATABASE_USER:-levi_admin}"
readonly source_database="levi"
readonly rollback_database="levi_rollback_$(date -u +%Y%m%dT%H%M%SZ | tr '[:upper:]' '[:lower:]')"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Production restore promotion must run as root." >&2
  exit 2
fi
if [[ ! "$restore_database" =~ ^levi_restore_[a-z0-9_]+$ ]]; then
  echo "LEVI_RESTORE_DATABASE must name a previously verified isolated restore." >&2
  exit 2
fi
if [[ ! "$approval_reference" =~ ^https://github\.com/iwaseasahi/levi/issues/[0-9]+#issuecomment-[0-9]+$ ]]; then
  echo "LEVI_RESTORE_APPROVAL_REFERENCE must be the exact immediate-approval GitHub comment URL." >&2
  exit 2
fi
if [[ ! -r "$restore_proof" ]]; then
  echo "The isolated restore proof is not readable: $restore_proof" >&2
  exit 2
fi
proved_database="$(awk -F= '$1 == "restore_database" {print $2}' "$restore_proof")"
if [[ "$proved_database" != "$restore_database" ]]; then
  echo "LEVI_RESTORE_DATABASE does not match the selected restore proof." >&2
  exit 2
fi

compose() {
  docker compose --env-file "$environment_file" --file "$compose_file" "$@"
}

session_count="$(compose exec -T "$database_service" psql --no-psqlrc \
  --tuples-only --no-align --username "$database_user" --dbname "$restore_database" \
  --command "SELECT count(*) FROM sessions;")"
session_count="${session_count//[[:space:]]/}"
if [[ "$session_count" != "0" ]]; then
  echo "Verified restore contains sessions; refusing promotion." >&2
  exit 1
fi

echo "Promoting ${restore_database}; approval=${approval_reference}; rollback=${rollback_database}"
compose stop proxy app

compose exec -T "$database_service" psql --no-psqlrc --set ON_ERROR_STOP=1 \
  --username "$database_user" --dbname postgres --command \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('${source_database}', '${restore_database}') AND pid <> pg_backend_pid();" >/dev/null
compose exec -T "$database_service" psql --no-psqlrc --set ON_ERROR_STOP=1 \
  --username "$database_user" --dbname postgres --command \
  "ALTER DATABASE ${source_database} RENAME TO ${rollback_database};"
compose exec -T "$database_service" psql --no-psqlrc --set ON_ERROR_STOP=1 \
  --username "$database_user" --dbname postgres --command \
  "ALTER DATABASE ${restore_database} RENAME TO ${source_database};"
compose exec -T "$database_service" psql --no-psqlrc --set ON_ERROR_STOP=1 \
  --username "$database_user" --dbname "$source_database" --command \
  "DELETE FROM sessions;" >/dev/null

if ! compose up --detach --wait app proxy; then
  echo "Promotion did not become ready. Services remain in their observed state; preserve ${rollback_database} and follow the rollback runbook." >&2
  exit 1
fi

echo "Restore promoted and ready. Previous database retained as ${rollback_database}; all sessions invalidated."
