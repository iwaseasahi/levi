#!/bin/bash
set -euo pipefail
umask 077
[[ "$EUID" -eq 0 && $# -le 1 && ( $# -eq 0 || "$1" == --dry-run ) ]] || { echo "Use the root scheduled service, optionally with --dry-run." >&2; exit 64; }
readonly state=/var/lib/levi-release
readonly bundle=/usr/local/lib/levi-release
source "${bundle}/scripts/lib/production-release-observation.sh"
export PATH="${bundle}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
export GH_HOST=github.com GH_PROMPT_DISABLED=1 GIT_TERMINAL_PROMPT=0
unset GH_TOKEN GITHUB_TOKEN GH_ENTERPRISE_TOKEN GITHUB_ENTERPRISE_TOKEN
# Skip before clone/authentication when a timer is invoked outside its start window.
if [[ $# -eq 0 && "$(TZ=Asia/Tokyo date +%u:%H)" != 2:10 ]]; then echo "Skipped: outside Tuesday 10:00 Asia/Tokyo."; exit 0; fi
mkdir -p "$state"
chmod 700 "$state"
# Serialize clone/preparation too; systemd already prevents duplicate unit starts.
mkdir "${state}/.launcher.lock" 2>/dev/null || { echo "A host scheduler is active." >&2; exit 75; }
trap 'rmdir "${state}/.launcher.lock" 2>/dev/null || true' EXIT
if [[ ! -d "${state}/repository/.git" ]]; then
  release_observe clone
  git clone --quiet https://github.com/iwaseasahi/levi.git "${state}/repository"
fi
LEVI_RELEASE_REPOSITORY="${state}/repository" LEVI_RELEASE_TRANSPORT=local \
  bash "${bundle}/scripts/run-scheduled-production-release.sh" "$@"

if [[ $# -eq 1 ]]; then
  source "${bundle}/scripts/lib/production-release-state.sh"
  require_matching_host_history "$(read_ready_production_deployment)" /var/lib/levi-deploy/current.env
  [[ "$(/usr/local/sbin/levi-production-deploy --protocol-version)" == 2 ]] || { echo "Host protocol is not installed." >&2; exit 69; }
  echo "Read-only host history and deployment protocol verification passed."
fi
