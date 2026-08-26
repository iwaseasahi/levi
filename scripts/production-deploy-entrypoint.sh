#!/bin/bash
set -euo pipefail
umask 077

readonly expected_operator="levi-system-operator"
readonly repository="/opt/levi"
readonly deploy_script="${repository}/scripts/production-deploy.sh"
readonly safe_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Production deployment entrypoint must run as root." >&2
  exit 2
fi
if [[ "${SUDO_USER:-}" != "$expected_operator" ]]; then
  echo "Production deployment entrypoint is restricted to the approved operator." >&2
  exit 2
fi
if [[ "$#" -ne 5 ]]; then
  echo "Usage: levi-production-deploy COMMIT_SHA APPLICATION_IMAGE MIGRATION_IMAGE AUTHORIZATION_RUN_URL SUNDAY_AUTHORIZATION_RUN_URL_OR_NONE" >&2
  exit 2
fi

readonly deploy_commit="$1"
readonly application_image="$2"
readonly migration_image="$3"
readonly approval_reference="$4"
readonly sunday_approval_argument="$5"

if [[ ! "$deploy_commit" =~ ^[a-f0-9]{40}$ ]]; then
  echo "COMMIT_SHA must be an exact 40-character commit SHA." >&2
  exit 2
fi
if [[ ! "$application_image" =~ ^ghcr\.io/iwaseasahi/levi@sha256:[a-f0-9]{64}$ ]]; then
  echo "APPLICATION_IMAGE must be an immutable ghcr.io/iwaseasahi/levi digest." >&2
  exit 2
fi
if [[ ! "$migration_image" =~ ^ghcr\.io/iwaseasahi/levi-migrate@sha256:[a-f0-9]{64}$ ]]; then
  echo "MIGRATION_IMAGE must be an immutable ghcr.io/iwaseasahi/levi-migrate digest." >&2
  exit 2
fi
if [[ ! "$approval_reference" =~ ^https://github\.com/iwaseasahi/levi/actions/runs/[0-9]+$ ]]; then
  echo "AUTHORIZATION_RUN_URL must be an exact Levi Actions run URL." >&2
  exit 2
fi
if [[ "$sunday_approval_argument" != "none" && ! "$sunday_approval_argument" =~ ^https://github\.com/iwaseasahi/levi/actions/runs/[0-9]+$ ]]; then
  echo "SUNDAY_AUTHORIZATION_RUN_URL_OR_NONE must be none or an exact Levi Actions run URL." >&2
  exit 2
fi
if [[ "$sunday_approval_argument" == "none" ]]; then
  readonly sunday_approval_reference=""
else
  readonly sunday_approval_reference="$sunday_approval_argument"
fi
if [[ ! -x "$deploy_script" ]]; then
  echo "The root-owned production deployment script is unavailable." >&2
  exit 1
fi

safe_git() {
  /usr/bin/env -i HOME=/root PATH="$safe_path" /usr/bin/git "$@"
}

safe_git -C "$repository" fetch --quiet origin main
if ! safe_git -C "$repository" merge-base --is-ancestor "$deploy_commit" origin/main; then
  echo "The approved commit is not an ancestor of origin/main." >&2
  exit 1
fi
safe_git -C "$repository" switch --detach "$deploy_commit"

exec /usr/bin/env -i \
  HOME=/root \
  PATH="$safe_path" \
  LEVI_DEPLOY_APPROVAL_REFERENCE="$approval_reference" \
  LEVI_DEPLOY_COMMIT="$deploy_commit" \
  LEVI_DEPLOY_REPOSITORY="$repository" \
  LEVI_IMAGE="$application_image" \
  LEVI_MIGRATION_IMAGE="$migration_image" \
  LEVI_SUNDAY_DEPLOY_APPROVAL_REFERENCE="$sunday_approval_reference" \
  "$deploy_script"
