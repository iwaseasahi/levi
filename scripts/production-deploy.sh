#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly deploy_commit="${LEVI_DEPLOY_COMMIT:-}"
readonly application_image="${LEVI_IMAGE:-}"
readonly migration_image="${LEVI_MIGRATION_IMAGE:-}"
readonly approval_reference="${LEVI_DEPLOY_APPROVAL_REFERENCE:-}"
readonly sunday_approval_reference="${LEVI_SUNDAY_DEPLOY_APPROVAL_REFERENCE:-}"
readonly repository="${LEVI_DEPLOY_REPOSITORY:-/opt/levi}"
readonly compose_file="${LEVI_COMPOSE_FILE:-/opt/levi/deploy/production/compose.yaml}"
readonly environment_file="${LEVI_ENV_FILE:-/etc/levi/production.env}"
readonly deployment_root="${LEVI_DEPLOYMENT_ROOT:-/var/lib/levi-deploy}"

if [[ "${EUID}" -ne 0 && "${LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL:-false}" != "true" ]]; then
  echo "Production deployment must run as root." >&2
  exit 2
fi
if [[ ! "$deploy_commit" =~ ^[a-f0-9]{40}$ ]]; then
  echo "LEVI_DEPLOY_COMMIT must be an exact 40-character commit SHA." >&2
  exit 2
fi
if [[ ! "$application_image" =~ ^ghcr\.io/iwaseasahi/levi@sha256:[a-f0-9]{64}$ ]]; then
  echo "LEVI_IMAGE must be an immutable ghcr.io/iwaseasahi/levi digest." >&2
  exit 2
fi
if [[ ! "$migration_image" =~ ^ghcr\.io/iwaseasahi/levi-migrate@sha256:[a-f0-9]{64}$ ]]; then
  echo "LEVI_MIGRATION_IMAGE must be an immutable ghcr.io/iwaseasahi/levi-migrate digest." >&2
  exit 2
fi
if [[ ! "$approval_reference" =~ ^https://github\.com/iwaseasahi/levi/issues/[0-9]+#issuecomment-[0-9]+$ ]]; then
  echo "LEVI_DEPLOY_APPROVAL_REFERENCE must be the exact immediate-approval GitHub comment URL." >&2
  exit 2
fi

weekday="$(TZ=Asia/Tokyo date +%u)"
if [[ "${LEVI_ALLOW_TEST_OVERRIDES:-false}" == "true" ]]; then
  weekday="${LEVI_DEPLOY_WEEKDAY_OVERRIDE:-$weekday}"
fi
if [[ "$weekday" == "7" ]]; then
  if [[ ! "$sunday_approval_reference" =~ ^https://github\.com/iwaseasahi/levi/issues/[0-9]+#issuecomment-[0-9]+$ ]]; then
    echo "Production deployment on Sunday requires an exact Sunday approval comment URL." >&2
    exit 1
  fi
elif [[ -n "$sunday_approval_reference" ]]; then
  echo "Sunday approval must not be supplied outside Sunday in Asia/Tokyo." >&2
  exit 1
fi
if [[ ! "$weekday" =~ ^[1-7]$ ]]; then
  echo "Unable to determine a safe deployment weekday." >&2
  exit 1
fi

repository_commit="$(git -C "$repository" rev-parse HEAD)"
if [[ "$repository_commit" != "$deploy_commit" ]]; then
  echo "Checked-out repository commit does not match LEVI_DEPLOY_COMMIT." >&2
  exit 1
fi

if [[ "${LEVI_DEPLOY_DRY_RUN:-false}" == "true" ]]; then
  echo "Production deployment preflight passed without changing containers."
  exit 0
fi

mkdir -p "$deployment_root"
chmod 700 "$deployment_root"
readonly lock_directory="${deployment_root}/.deploy.lock"
if ! mkdir "$lock_directory" 2>/dev/null; then
  echo "Another production deployment is already running." >&2
  exit 1
fi
cleanup() {
  rmdir "$lock_directory" 2>/dev/null || true
}
trap cleanup EXIT

compose() {
  LEVI_IMAGE="$application_image" LEVI_MIGRATION_IMAGE="$migration_image" \
    docker compose --env-file "$environment_file" --file "$compose_file" "$@"
}

docker pull "$application_image"
docker pull "$migration_image"
for image in "$application_image" "$migration_image"; do
  image_commit="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")"
  if [[ "$image_commit" != "$deploy_commit" ]]; then
    echo "Image revision label does not match approved commit: $image" >&2
    exit 1
  fi
done

compose config --quiet
"${repository}/scripts/production-backup.sh" operational
compose --profile migration run --rm migrate
compose up --detach --wait postgres app proxy

readonly deployed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
readonly deployment_id="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "${deployment_root}/history"
chmod 700 "${deployment_root}/history"
readonly deployment_record="${deployment_root}/history/${deployment_id}-${deploy_commit}.env"
{
  printf 'deployed_at=%s\n' "$deployed_at"
  printf 'commit=%s\n' "$deploy_commit"
  printf 'application_image=%s\n' "$application_image"
  printf 'migration_image=%s\n' "$migration_image"
  printf 'approval=%s\n' "$approval_reference"
  printf 'sunday_approval=%s\n' "${sunday_approval_reference:-none}"
} >"$deployment_record"
chmod 600 "$deployment_record"
cp "$deployment_record" "${deployment_root}/current.env"
chmod 600 "${deployment_root}/current.env"

echo "Production deployment is ready: commit=${deploy_commit} application_image=${application_image}"
