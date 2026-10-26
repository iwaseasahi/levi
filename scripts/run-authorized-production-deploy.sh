#!/usr/bin/env bash

set -euo pipefail
readonly script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_directory}/lib/production-release-state.sh"
source "${script_directory}/lib/production-authorization.sh"
require_unattended_context
readonly transport="${LEVI_RELEASE_TRANSPORT:-ssh}"
case "$transport" in
  ssh) ;;
  local)
    [[ "$EUID" -eq 0 ]] && is_unattended_deployment || {
      echo "Local release transport is restricted to the root scheduled service." >&2; exit 64;
    } ;;
  *) echo "Unknown production release transport." >&2; exit 64 ;;
esac
if [[ "${1:-}" == "--" ]]; then shift; fi
if [[ $# -ne 1 || ! "$1" =~ ^[0-9]+$ ]]; then
  echo "Usage: pnpm production:deploy:authorized -- RUN_ID" >&2
  exit 64
fi
for command in gh jq openssl awk; do command -v "$command" >/dev/null || exit 69; done
authorization="$(read_verified_production_authorization "$1")"
readonly commit_sha="$(jq -r .commit_sha <<<"$authorization")"
readonly application_image="$(jq -r .application_image <<<"$authorization")"
readonly migration_image="$(jq -r .migration_image <<<"$authorization")"
readonly authorization_run_url="$(jq -r .authorization_run_url <<<"$authorization")"
readonly sunday_authorization_run_url="$(jq -r '.sunday_authorization_run_url // "none"' <<<"$authorization")"
previous_commit=""
previous_state_hash=""
if is_unattended_deployment; then
  [[ "$commit_sha" == "$LEVI_UNATTENDED_EXPECTED_COMMIT" && "$sunday_authorization_run_url" == none ]] || {
    echo "Authorization does not match the scheduled exact commit/day." >&2; exit 65;
  }
  actual_deployment="$(read_ready_production_deployment)"
  if [[ "$(jq -r .commit_sha <<<"$actual_deployment")" == "$commit_sha" ]]; then
    echo "Skipped: the scheduled commit has already been successfully deployed."; exit 0
  fi
  [[ "$actual_deployment" == "$LEVI_UNATTENDED_EXPECTED_DEPLOYMENT" ]] || {
    echo "Production state changed before apply; automatic deployment stopped." >&2; exit 75;
  }
  previous_commit="$(jq -r .commit_sha <<<"$actual_deployment")"
  previous_state_hash="$(printf '%s' "$actual_deployment" | openssl dgst -sha256 -r | awk '{print $1}')"
  require_unattended_context
fi
# The host re-verifies the artifact and owns all metadata writes under its lock.
if [[ "$transport" == local ]]; then
  [[ "$(/usr/local/sbin/levi-production-deploy --protocol-version)" == 2 ]] || { echo "Host deployment protocol is not installed." >&2; exit 69; }
  /usr/local/sbin/levi-production-deploy "$commit_sha" "$application_image" "$migration_image" "$authorization_run_url" none "$previous_commit" "$previous_state_hash"
else
  readonly ssh_host_alias="${LEVI_PRODUCTION_SSH_ALIAS:-levi-system-production}"
  protocol="$(ssh -o BatchMode=yes "$ssh_host_alias" "sudo -n /usr/local/sbin/levi-production-deploy --protocol-version")"
  [[ "$protocol" == 2 ]] || { echo "Install the reviewed host deployment protocol before applying." >&2; exit 69; }
  deploy_command="sudo -n /usr/local/sbin/levi-production-deploy '$commit_sha' '$application_image' '$migration_image' '$authorization_run_url' '$sunday_authorization_run_url'"
  if is_unattended_deployment; then deploy_command+=" '$previous_commit' '$previous_state_hash'"; fi
  ssh -o BatchMode=yes "$ssh_host_alias" "$deploy_command"
fi
