#!/usr/bin/env bash
set -euo pipefail

readonly base_url="${LEVI_PRODUCTION_BASE_URL:-}"
readonly compose_file="${LEVI_COMPOSE_FILE:-/opt/levi/deploy/production/compose.yaml}"
readonly environment_file="${LEVI_ENV_FILE:-/etc/levi/production.env}"
readonly disk_limit="${LEVI_DISK_CAPACITY_PERCENT:-80}"
readonly memory_limit="${LEVI_MEMORY_CAPACITY_PERCENT:-90}"
readonly five_xx_limit="${LEVI_FIVE_XX_LIMIT:-5}"

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

five_xx_count="$(compose logs --since 5m --no-color --no-log-prefix proxy 2>/dev/null | \
  jq -Rsc 'split("\n") | map(fromjson? | select((.status // 0) >= 500)) | length')"
if [[ ! "$five_xx_count" =~ ^[0-9]+$ ]] || (( five_xx_count >= five_xx_limit )); then
  echo "Caddy observed ${five_xx_count:-unknown} 5xx responses in five minutes (limit ${five_xx_limit})." >&2
  exit 1
fi

echo "Production health passed: readiness=ready database=ready disk_percent=${disk_used} memory_percent=${memory_used} five_xx_5m=${five_xx_count}"
