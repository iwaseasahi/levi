#!/usr/bin/env bash
set -euo pipefail

readonly backup_root="${LEVI_BACKUP_ROOT:-/var/backups/levi}"
readonly capacity_limit="${LEVI_BACKUP_CAPACITY_PERCENT:-80}"

if [[ "${EUID}" -ne 0 && "${LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL:-false}" != "true" ]]; then
  echo "Production backup monitoring must run as root." >&2
  exit 2
fi

latest_weekly="$(find "${backup_root}/weekly" -type f -name '*.tar.cms' -mmin -11520 -print -quit 2>/dev/null || true)"
if [[ -z "$latest_weekly" ]]; then
  echo "No encrypted weekly Levi backup is newer than 8 days." >&2
  exit 1
fi

capacity_used="$(df -Pk "$backup_root" | awk 'NR == 2 {gsub("%", "", $5); print $5}')"
if [[ ! "$capacity_used" =~ ^[0-9]+$ ]] || (( capacity_used >= capacity_limit )); then
  echo "Levi backup filesystem usage is ${capacity_used:-unknown}% (limit ${capacity_limit}%)." >&2
  exit 1
fi

latest_restore_proof="${backup_root}/restore-proofs/latest.env"
if [[ ! -f "$latest_restore_proof" ]]; then
  echo "No successful isolated restore proof exists." >&2
  exit 1
fi
recent_restore_proof="$(find "$latest_restore_proof" -type f -mtime -90 -print -quit 2>/dev/null || true)"
if [[ -z "$recent_restore_proof" ]]; then
  echo "The newest isolated restore proof is older than 90 days." >&2
  exit 1
fi

echo "Backup health passed: weekly=${latest_weekly} capacity_percent=${capacity_used} restore_proof=${latest_restore_proof}"
