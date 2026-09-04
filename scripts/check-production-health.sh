#!/usr/bin/env bash
set -euo pipefail

readonly base_url="${LEVI_PRODUCTION_BASE_URL:-}"
readonly compose_file="${LEVI_COMPOSE_FILE:-/opt/levi/deploy/production/compose.yaml}"
readonly environment_file="${LEVI_ENV_FILE:-/etc/levi/production.env}"
readonly disk_limit="${LEVI_DISK_CAPACITY_PERCENT:-80}"
readonly memory_limit="${LEVI_MEMORY_CAPACITY_PERCENT:-90}"
readonly five_xx_limit="${LEVI_FIVE_XX_LIMIT:-5}"
readonly image_capacity_limit="${LEVI_SLIDE_IMAGE_CAPACITY_PERCENT:-80}"

if [[ "${EUID}" -ne 0 && "${LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL:-false}" != "true" ]]; then
  echo "Production health checks must run as root." >&2
  exit 2
fi
if [[ ! "$base_url" =~ ^https://[^/]+$ ]]; then
  echo "LEVI_PRODUCTION_BASE_URL must be an exact HTTPS origin." >&2
  exit 2
fi

compose() {
  docker compose --env-file "$environment_file" --file "$compose_file" "$@"
}

readiness="$(curl --fail --silent --show-error --max-time 10 "${base_url}/api/ready")"
if [[ "$(printf '%s' "$readiness" | jq -r '.status // empty')" != "ready" ]]; then
  echo "Levi readiness response was not ready." >&2
  exit 1
fi

compose exec -T postgres sh -c \
  'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null
"$(dirname "${BASH_SOURCE[0]}")/check-production-backups.sh" >/dev/null

image_quota_bytes="$(awk -F= '$1 == "SLIDE_IMAGE_BYTES_PER_CHURCH" {print $2}' "$environment_file")"
if [[ ! "$image_quota_bytes" =~ ^[0-9]+$ ]]; then
  echo "SLIDE_IMAGE_BYTES_PER_CHURCH is missing or invalid." >&2
  exit 2
fi
image_metrics="$(compose exec -T postgres sh -c \
  'psql -At --no-psqlrc --set ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<SQL
SELECT
  COALESCE((SELECT MAX(used_percent) FROM (
    SELECT floor(SUM(byte_size) * 100.0 / ${image_quota_bytes})::integer AS used_percent
    FROM slide_images GROUP BY church_id
  ) usage), 0)::text || '|' ||
  pg_total_relation_size('slide_images')::text || '|' ||
  pg_database_size(current_database())::text;
SQL
)"
image_metrics="${image_metrics//[[:space:]]/}"
IFS='|' read -r image_capacity_used image_table_bytes database_bytes <<<"$image_metrics"
latest_backup_bytes="$(find "${LEVI_BACKUP_ROOT:-/var/backups/levi}/weekly" \
  -type f -name '*.tar.cms' -printf '%T@ %s\n' | sort -n | tail -1 | awk '{print $2}')"

disk_used="$(df -Pk / | awk 'NR == 2 {gsub("%", "", $5); print $5}')"
memory_used="$(free -m | awk '/^Mem:/ {printf "%d", (($2-$7)*100)/$2}')"
if [[ ! "$disk_used" =~ ^[0-9]+$ ]] || (( disk_used >= disk_limit )); then
  echo "Production disk usage is ${disk_used:-unknown}% (limit ${disk_limit}%)." >&2
  exit 1
fi
if [[ ! "$memory_used" =~ ^[0-9]+$ ]] || (( memory_used >= memory_limit )); then
  echo "Production memory usage is ${memory_used:-unknown}% (limit ${memory_limit}%)." >&2
  exit 1
fi
if [[ ! "$image_capacity_used" =~ ^[0-9]+$ || ! "$image_table_bytes" =~ ^[0-9]+$ || ! "$database_bytes" =~ ^[0-9]+$ || ! "$latest_backup_bytes" =~ ^[0-9]+$ ]]; then
  echo "Production storage metrics are invalid." >&2
  exit 1
fi
if (( image_capacity_used >= image_capacity_limit )); then
  echo "A church's Slide image usage is ${image_capacity_used:-unknown}% (limit ${image_capacity_limit}%)." >&2
  exit 1
fi

five_xx_count="$(compose logs --since 5m --no-color --no-log-prefix proxy 2>/dev/null | \
  jq -Rsc 'split("\n") | map(fromjson? | select((.status // 0) >= 500)) | length')"
if [[ ! "$five_xx_count" =~ ^[0-9]+$ ]] || (( five_xx_count >= five_xx_limit )); then
  echo "Caddy observed ${five_xx_count:-unknown} 5xx responses in five minutes (limit ${five_xx_limit})." >&2
  exit 1
fi

echo "Production health passed: readiness=ready database=ready disk_percent=${disk_used} memory_percent=${memory_used} slide_image_percent=${image_capacity_used} slide_image_table_bytes=${image_table_bytes} database_bytes=${database_bytes} weekly_backup_bytes=${latest_backup_bytes} five_xx_5m=${five_xx_count}"
