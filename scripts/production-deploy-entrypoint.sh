#!/bin/bash
set -euo pipefail
umask 077

readonly repository_path="/opt/levi"
readonly repository="iwaseasahi/levi"
readonly deploy_script="${repository_path}/scripts/production-deploy.sh"
readonly safe_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
readonly bundle="/usr/local/lib/levi-release"
export PATH="$safe_path"
if [[ "$EUID" -ne 0 ]]; then
  echo "Production deployment entrypoint must run as root." >&2; exit 2
fi
if [[ $# -eq 1 && "$1" == --protocol-version ]]; then
  [[ "${SUDO_USER:-}" == levi-system-operator || -z "${SUDO_USER:-}" ]] || exit 2
  echo 2
  exit 0
fi
if [[ "$#" -ne 5 && "$#" -ne 7 ]]; then
  echo "Usage: levi-production-deploy COMMIT_SHA APPLICATION_IMAGE MIGRATION_IMAGE AUTHORIZATION_RUN_URL SUNDAY_AUTHORIZATION_RUN_URL_OR_NONE [EXPECTED_PREVIOUS_COMMIT EXPECTED_READY_STATE_SHA256]" >&2; exit 2
fi
if [[ "${SUDO_USER:-}" != levi-system-operator && !("$#" -eq 7 && -z "${SUDO_USER:-}") ]]; then
  echo "Production deployment entrypoint is restricted to the approved operator or root timer." >&2; exit 2
fi
readonly deploy_commit="$1" application_image="$2" migration_image="$3" approval_reference="$4" sunday_approval_argument="$5"
readonly previous_commit="${6:-}" previous_state_hash="${7:-}"
[[ "$deploy_commit" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid COMMIT_SHA." >&2; exit 2; }
[[ "$application_image" =~ ^ghcr\.io/iwaseasahi/levi@sha256:[a-f0-9]{64}$ ]] || { echo "Invalid APPLICATION_IMAGE." >&2; exit 2; }
[[ "$migration_image" =~ ^ghcr\.io/iwaseasahi/levi-migrate@sha256:[a-f0-9]{64}$ ]] || { echo "Invalid MIGRATION_IMAGE." >&2; exit 2; }
[[ "$approval_reference" =~ ^https://github\.com/iwaseasahi/levi/actions/runs/([0-9]+)$ ]] || { echo "Invalid AUTHORIZATION_RUN_URL." >&2; exit 2; }
readonly authorization_run_id="${BASH_REMATCH[1]}"
[[ "$sunday_approval_argument" == none || "$sunday_approval_argument" =~ ^https://github\.com/iwaseasahi/levi/actions/runs/[0-9]+$ ]] || { echo "Invalid SUNDAY_AUTHORIZATION_RUN_URL." >&2; exit 2; }
if [[ $# -eq 7 ]]; then
  [[ "$previous_commit" =~ ^[a-f0-9]{40}$ && "$previous_state_hash" =~ ^[a-f0-9]{64}$ && "$sunday_approval_argument" == none && "$(TZ=Asia/Tokyo date +%u)" == 2 ]] || {
    echo "Scheduled application requires Tuesday and an exact prior commit." >&2; exit 75;
  }
fi

# Fixed installed helpers and a cleared GitHub environment: never trust caller code/auth.
source "${bundle}/scripts/lib/production-authorization.sh"
source "${bundle}/scripts/lib/production-release-state.sh"
gh() { /usr/bin/env -i HOME=/root PATH="$safe_path" "${bundle}/bin/gh" "$@"; }
safe_git() { /usr/bin/env -i HOME=/root PATH="$safe_path" /usr/bin/git "$@"; }
readonly deployment_root="/var/lib/levi-deploy"
mkdir -p "$deployment_root"
chmod 700 "$deployment_root"
readonly transaction_lock="${deployment_root}/.transaction.lock"
mkdir "$transaction_lock" 2>/dev/null || { echo "Another host deployment transaction is active." >&2; exit 75; }
trap 'rmdir "$transaction_lock" 2>/dev/null || true' EXIT

verified="$(read_verified_production_authorization "$authorization_run_id")"
jq -e --arg commit "$deploy_commit" --arg app "$application_image" --arg migration "$migration_image" --arg sunday "$sunday_approval_argument" \
  '.commit_sha == $commit and .application_image == $app and .migration_image == $migration and (.sunday_authorization_run_url // "none") == $sunday' \
  <<<"$verified" >/dev/null || { echo "Host authorization does not match the requested release." >&2; exit 65; }
if [[ -n "$previous_commit" ]]; then
  current="$(read_ready_production_deployment)"
  [[ "$(jq -r .commit_sha <<<"$current")" == "$previous_commit" ]] || { echo "Scheduled deployment baseline changed." >&2; exit 75; }
  actual_state_hash="$(printf '%s' "$current" | openssl dgst -sha256 -r | awk '{print $1}')"
  [[ "$actual_state_hash" == "$previous_state_hash" ]] || { echo "The ready deployment record changed before host apply." >&2; exit 75; }
  require_matching_host_history "$current" "${deployment_root}/current.env"
fi
safe_git -C "$repository_path" fetch --quiet origin main
safe_git -C "$repository_path" merge-base --is-ancestor "$deploy_commit" origin/main || { echo "The approved commit is not on main." >&2; exit 65; }
if [[ -n "$previous_commit" ]]; then
  [[ "$deploy_commit" != "$previous_commit" ]] && safe_git -C "$repository_path" merge-base --is-ancestor "$previous_commit" "$deploy_commit" || {
    echo "Scheduled release must move production forward." >&2; exit 65;
  }
fi
/usr/bin/env -i HOME=/root PATH="${bundle}/bin:$safe_path" /bin/bash "${bundle}/scripts/wait-for-required-ci.sh" "$deploy_commit"
if [[ -n "$previous_commit" && "$(TZ=Asia/Tokyo date +%u)" != 2 ]]; then
  echo "Scheduled application cannot start outside Tuesday." >&2; exit 75
fi
host_weekday="$(TZ=Asia/Tokyo date +%u)"
if [[ "$host_weekday" == 7 ]]; then
  [[ "$sunday_approval_argument" == "$approval_reference" ]] || { echo "Sunday requires exact Sunday authorization." >&2; exit 75; }
else
  [[ "$sunday_approval_argument" == none ]] || { echo "Sunday authorization cannot be used outside Sunday." >&2; exit 75; }
fi
safe_git -C "$repository_path" switch --detach "$deploy_commit"
[[ -x "$deploy_script" ]] || { echo "Production deployment script is unavailable." >&2; exit 1; }
readonly commit_sha="$deploy_commit" authorization_run_url="$approval_reference"
record_deployment_state deploying
/usr/bin/env -i HOME=/root PATH="$safe_path" \
  LEVI_DEPLOY_APPROVAL_REFERENCE="$approval_reference" LEVI_DEPLOY_COMMIT="$deploy_commit" \
  LEVI_DEPLOY_REPOSITORY="$repository_path" LEVI_IMAGE="$application_image" LEVI_MIGRATION_IMAGE="$migration_image" \
  LEVI_SUNDAY_DEPLOY_APPROVAL_REFERENCE="$(if [[ "$sunday_approval_argument" != none ]]; then echo "$sunday_approval_argument"; fi)" \
  "$deploy_script"
record_deployment_state ready
echo "Host deployment transaction completed at ${deploy_commit}."
