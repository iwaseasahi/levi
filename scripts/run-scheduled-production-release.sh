#!/usr/bin/env bash

set -euo pipefail
umask 077

readonly script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly repository_root="${LEVI_RELEASE_REPOSITORY:-$(cd "${script_directory}/.." && pwd)}"
readonly transport="${LEVI_RELEASE_TRANSPORT:-ssh}"
[[ "$transport" == ssh || ("$transport" == local && "$EUID" -eq 0) ]] || { echo "Invalid release transport." >&2; exit 64; }
# shellcheck source=lib/production-release-state.sh
source "${script_directory}/lib/production-release-state.sh"

if [[ $# -gt 1 || ($# -eq 1 && "$1" != "--dry-run") ]]; then
  echo "Usage: run-scheduled-production-release.sh [--dry-run]" >&2
  exit 64
fi
readonly dry_run="$(if [[ $# -eq 1 ]]; then echo true; else echo false; fi)"
for command in gh git jq date ssh; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command is unavailable: $command" >&2
    exit 69
  }
done

if [[ "$dry_run" != "true" && "$(TZ=Asia/Tokyo date +%u:%H)" != "2:10" ]]; then
  echo "Skipped: the scheduled start window is Tuesday 10:00–10:59 Asia/Tokyo."
  exit 0
fi

cd "$repository_root"
common_directory="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
readonly common_directory
readonly lock_directory="${common_directory}/levi-scheduled-production-release.lock"
if ! mkdir "$lock_directory" 2>/dev/null; then
  echo "Another scheduled release is active; automatic deployment stopped." >&2
  exit 75
fi
temporary_directory=""
snapshot=""
cleanup() {
  if [[ -n "$snapshot" && -d "$snapshot" ]]; then
    git worktree remove --force "$snapshot" >/dev/null 2>&1 || true
  fi
  if [[ -n "$temporary_directory" ]]; then
    rm -rf "$temporary_directory"
  fi
  rmdir "$lock_directory" 2>/dev/null || true
}
trap cleanup EXIT

origin_url="$(git remote get-url origin)"
case "$origin_url" in
  git@github.com:iwaseasahi/levi.git|https://github.com/iwaseasahi/levi.git|https://github.com/iwaseasahi/levi) ;;
  *) echo "The deployment repository origin is not canonical." >&2; exit 65 ;;
esac
git fetch --quiet origin main
readonly commit_sha="$(git rev-parse origin/main)"
[[ "$commit_sha" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid main commit." >&2; exit 65; }
deployment="$(read_ready_production_deployment)"
readonly deployment
readonly previous_commit="$(jq -r .commit_sha <<<"$deployment")"
if [[ "$previous_commit" == "$commit_sha" ]]; then
  echo "Skipped: main is already successfully deployed at ${commit_sha}."
  exit 0
fi
git merge-base --is-ancestor "$previous_commit" "$commit_sha" || {
  echo "Production is not an ancestor of pinned main; automatic rollback is forbidden." >&2
  exit 65
}
if [[ "$dry_run" == "true" ]]; then
  echo "Dry run: would release ${commit_sha}; current successful release is ${previous_commit}."
  echo "No image workflow, authorization or production connection was started."
  exit 0
fi

# Execute only committed scripts from main after its protected checks pass.
git diff --quiet HEAD -- scripts || { echo "Deployment scripts have local changes." >&2; exit 65; }
git merge-base --is-ancestor HEAD origin/main || { echo "Deployment launcher is not from main." >&2; exit 65; }
GITHUB_REPOSITORY=iwaseasahi/levi bash "${script_directory}/wait-for-required-ci.sh" "$commit_sha"
if [[ "$transport" == ssh ]]; then
  export LEVI_PRODUCTION_SSH_ALIAS=levi-system-production
  ssh -o BatchMode=yes -o ConnectTimeout=10 "$LEVI_PRODUCTION_SSH_ALIAS" true
fi

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/levi-scheduled-release.XXXXXX")"
snapshot="${temporary_directory}/release"
git worktree add --quiet --detach "$snapshot" "$commit_sha"
readonly candidate_file="${temporary_directory}/candidate.json"
bash "${snapshot}/scripts/prepare-production-release.sh" --commit "$commit_sha" --output "$candidate_file"
jq -e --arg commit_sha "$commit_sha" '.commit_sha == $commit_sha and (.run_id | type == "number")' "$candidate_file" >/dev/null
readonly candidate_run_id="$(jq -r .run_id "$candidate_file")"

# Detect manual/concurrent state changes again immediately before applying.
export LEVI_UNATTENDED_DEPLOYMENT=true
export LEVI_UNATTENDED_EXPECTED_COMMIT="$commit_sha"
export LEVI_UNATTENDED_EXPECTED_DEPLOYMENT="$deployment"
require_unattended_context
latest_deployment="$(read_ready_production_deployment)"
if [[ "$(jq -r .commit_sha <<< "$latest_deployment")" == "$commit_sha" ]]; then
  echo "Skipped: the candidate was successfully deployed while images were prepared."
  exit 0
fi
if [[ "$latest_deployment" != "$deployment" ]]; then
  echo "Production state changed while preparing the candidate; automatic deployment stopped." >&2
  exit 75
fi
bash "${snapshot}/scripts/deploy-production-release.sh" -- "$candidate_run_id"
echo "Scheduled production release completed at ${commit_sha}."
