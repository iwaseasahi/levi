#!/usr/bin/env bash
set -euo pipefail

readonly restore_database="levi_restore_rehearsal"
archive_path="$(mktemp "${TMPDIR:-/tmp}/levi-backup.XXXXXX")"

cleanup() {
  docker compose exec -T postgres dropdb --if-exists -U levi "$restore_database" >/dev/null 2>&1 || true
  rm -f "$archive_path"
}
trap cleanup EXIT

docker compose up -d --wait postgres
docker compose exec -T postgres pg_dump -U levi -d levi --format=custom >"$archive_path"
docker compose exec -T postgres pg_restore --list <"$archive_path" >/dev/null

docker compose exec -T postgres dropdb --if-exists -U levi "$restore_database"
docker compose exec -T postgres createdb -U levi "$restore_database"
docker compose exec -T postgres pg_restore \
  --exit-on-error \
  --no-owner \
  -U levi \
  -d "$restore_database" <"$archive_path"

readonly reconciliation_query='SELECT (SELECT count(*) FROM system_settings)::text || '"'"':'"'"' || (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL)::text;'
source_counts="$(docker compose exec -T postgres psql -At -U levi -d levi -c "$reconciliation_query")"
restore_counts="$(docker compose exec -T postgres psql -At -U levi -d "$restore_database" -c "$reconciliation_query")"

if [[ "$source_counts" != "$restore_counts" ]]; then
  echo "Backup reconciliation failed: source=$source_counts restore=$restore_counts" >&2
  exit 1
fi

archive_hash="$(shasum -a 256 "$archive_path" | cut -d ' ' -f 1)"
echo "Backup restore rehearsal passed: counts=$source_counts archive_sha256=$archive_hash"
