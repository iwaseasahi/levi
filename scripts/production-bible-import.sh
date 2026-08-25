#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly dump_argument="${1:-}"
readonly expected_source_sha="${LEVI_IMPORT_SOURCE_SHA:-}"
readonly approval_reference="${LEVI_IMPORT_APPROVAL_REFERENCE:-}"
readonly repository="${LEVI_DEPLOY_REPOSITORY:-/opt/levi}"
readonly compose_file="${LEVI_COMPOSE_FILE:-/opt/levi/deploy/production/compose.yaml}"
readonly environment_file="${LEVI_ENV_FILE:-/etc/levi/production.env}"
readonly import_root="${LEVI_IMPORT_ROOT:-/var/lib/levi-import}"
readonly report_root="${LEVI_IMPORT_REPORT_ROOT:-/var/lib/levi-import/reports}"

if [[ "$EUID" -ne 0 && "${LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL:-false}" != "true" ]]; then
  echo "Production Bible import must run as root." >&2
  exit 2
fi
if [[ ! "$expected_source_sha" =~ ^[a-f0-9]{64}$ ]]; then
  echo "LEVI_IMPORT_SOURCE_SHA must be the approved SHA-256." >&2
  exit 2
fi
if [[ ! "$approval_reference" =~ ^https://github\.com/iwaseasahi/levi/issues/[0-9]+#issuecomment-[0-9]+$ ]]; then
  echo "LEVI_IMPORT_APPROVAL_REFERENCE must be the immediate approval comment URL." >&2
  exit 2
fi

weekday="$(TZ=Asia/Tokyo date +%u)"
if [[ "${LEVI_ALLOW_TEST_OVERRIDES:-false}" == "true" ]]; then
  weekday="${LEVI_IMPORT_WEEKDAY_OVERRIDE:-$weekday}"
fi
if [[ "$weekday" == "7" ]]; then
  echo "Production migration and Bible import are frozen on Sunday in Asia/Tokyo." >&2
  exit 1
fi

if [[ -z "$dump_argument" || ! -f "$dump_argument" ]]; then
  echo "Pass the approved production dump path." >&2
  exit 2
fi
readonly dump_path="$(realpath "$dump_argument")"
case "$dump_path" in
  "$import_root"/*.sql) ;;
  *)
    echo "Production dump must be a .sql file directly below the protected import root." >&2
    exit 2
    ;;
esac
if [[ "$(stat -c %a "$dump_path")" != "400" || "$(stat -c %u:%g "$dump_path")" != "1000:0" ]]; then
  echo "Production dump must be mode 400 and owned by container uid 1000 and root group." >&2
  exit 2
fi
if [[ "$(sha256sum "$dump_path" | awk '{print $1}')" != "$expected_source_sha" ]]; then
  echo "Production dump SHA-256 does not match the approved source." >&2
  exit 1
fi

mkdir -p "$report_root"
chmod 700 "$import_root" "$report_root"
readonly lock_directory="${import_root}/.import.lock"
if ! mkdir "$lock_directory" 2>/dev/null; then
  echo "Another production Bible import is already running." >&2
  exit 1
fi
cleanup() {
  rmdir "$lock_directory" 2>/dev/null || true
}
trap cleanup EXIT
readonly execution_root="$(mktemp -d "${report_root}/$(date -u +%Y%m%dT%H%M%SZ).XXXXXX")"
chmod 700 "$execution_root"

compose() {
  docker compose --env-file "$environment_file" --file "$compose_file" "$@"
}

import_cli() {
  local mode="$1"
  shift
  compose --profile migration run --rm --no-deps \
    --volume "${dump_path}:/import/ginmaku.sql:ro" \
    --entrypoint /app/scripts/run-production-bible-import.sh \
    migrate "$mode" /import/ginmaku.sql "$@"
}

readonly validate_report="${execution_root}/01-validate.json"
readonly dry_run_report="${execution_root}/02-dry-run.json"
readonly import_report="${execution_root}/03-import.json"
readonly reconcile_report="${execution_root}/04-reconcile.json"
readonly retry_report="${execution_root}/05-idempotency.json"

compose up --detach --wait postgres
readonly postgres_container="$(compose ps --quiet postgres)"
[[ -n "$postgres_container" ]]
[[ -z "$(docker port "$postgres_container")" ]] || {
  echo "PostgreSQL unexpectedly publishes a host port." >&2
  exit 1
}

compose --profile migration run --rm migrate
compose --profile migration run --rm --no-deps \
  --entrypoint /app/scripts/run-production-database-bootstrap.sh migrate
"${repository}/scripts/production-backup.sh" operational

import_cli validate >"$validate_report"
jq -e --arg sha "$expected_source_sha" \
  '.mode == "validate" and .source.input.sha256 == $sha and .source.validation.duplicateLocations == 0 and .source.validation.invalidKeys == 0 and .source.validation.nullValues == 0 and .source.validation.verseGaps == 0' \
  "$validate_report" >/dev/null

import_cli dry-run >"$dry_run_report"
jq -e '.mode == "dry-run" and (.action == "import" or .action == "unchanged")' \
  "$dry_run_report" >/dev/null

import_cli import --confirm-source-sha "$expected_source_sha" --batch-size 500 >"$import_report"
jq -e '.mode == "import" and (.status == "imported" or .status == "unchanged")' \
  "$import_report" >/dev/null

import_cli reconcile >"$reconcile_report"
jq -e '.mode == "reconcile" and .exact == true and .sampleExact == true' \
  "$reconcile_report" >/dev/null

import_cli import --confirm-source-sha "$expected_source_sha" --batch-size 500 >"$retry_report"
jq -e '.mode == "import" and .status == "unchanged" and .report.exact == true and .report.sampleExact == true' \
  "$retry_report" >/dev/null

"${repository}/scripts/production-backup.sh" operational

chmod 600 "$execution_root"/*.json
{
  printf 'executed_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'source_sha256=%s\n' "$expected_source_sha"
  printf 'approval=%s\n' "$approval_reference"
  printf 'report_directory=%s\n' "$execution_root"
} >"${execution_root}/evidence.env"
chmod 600 "${execution_root}/evidence.env"

jq -c '{counts: .source.counts, integrity: .source.integrity, exact, sampleExact}' \
  "$reconcile_report"
echo "Production Bible migration, import, reconciliation, idempotency check, and encrypted backups completed."
