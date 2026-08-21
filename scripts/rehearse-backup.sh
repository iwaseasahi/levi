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

readonly reconciliation_query="SELECT concat_ws(':',
  (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL),
  (SELECT count(*) FROM system_settings),
  (SELECT count(*) FROM users),
  (SELECT count(*) FROM accounts),
  (SELECT count(*) FROM sessions),
  (SELECT count(*) FROM churches),
  (SELECT count(*) FROM church_memberships),
  (SELECT count(*) FROM platform_operators),
  (SELECT count(*) FROM bible_translations),
  (SELECT count(*) FROM bible_books),
  (SELECT count(*) FROM bible_book_names),
  (SELECT count(*) FROM bible_verses),
  (SELECT count(*) FROM folders),
  (SELECT count(*) FROM bookmarks),
  (SELECT count(*) FROM scripture_bookmarks),
  (SELECT md5(coalesce(string_agg(id::text || ':' || md5(text), ',' ORDER BY id), '')) FROM bible_verses)
);"
source_signature="$(docker compose exec -T postgres psql -At -U levi -d levi -c "$reconciliation_query")"
restore_signature="$(docker compose exec -T postgres psql -At -U levi -d "$restore_database" -c "$reconciliation_query")"

if [[ "$source_signature" != "$restore_signature" ]]; then
  echo "Backup reconciliation failed: anonymous signatures differ" >&2
  exit 1
fi

archive_hash="$(shasum -a 256 "$archive_path" | cut -d ' ' -f 1)"
echo "Backup restore rehearsal passed: anonymous_signature=$source_signature archive_sha256=$archive_hash"
