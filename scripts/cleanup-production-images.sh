#!/usr/bin/env bash
set -euo pipefail

dry_run=false
if [[ "${1:-}" == "--dry-run" ]]; then
  dry_run=true
  shift
fi

readonly application_image="${1:-}"
readonly migration_image="${2:-}"

if [[ "${EUID}" -ne 0 && "${LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL:-false}" != "true" ]]; then
  echo "Production Docker image cleanup must run as root." >&2
  exit 2
fi
if [[ ! "$application_image" =~ ^ghcr\.io/iwaseasahi/levi@sha256:[a-f0-9]{64}$ ]]; then
  echo "Pass the current immutable Levi application image." >&2
  exit 2
fi
if [[ ! "$migration_image" =~ ^ghcr\.io/iwaseasahi/levi-migrate@sha256:[a-f0-9]{64}$ ]]; then
  echo "Pass the current immutable Levi migration image." >&2
  exit 2
fi

docker image inspect "$application_image" "$migration_image" >/dev/null

echo "Docker disk usage before scoped cleanup:"
docker system df

readonly running_image_ids="$(
  docker ps --quiet | xargs --no-run-if-empty docker inspect \
    --format '{{.Image}}' | sort --unique
)"

is_running_image() {
  local candidate_id="$1"
  grep --fixed-strings --line-regexp --quiet "$candidate_id" \
    <<<"$running_image_ids"
}

references_current_digest() {
  local candidate_id="$1"
  docker image inspect --format '{{ range .RepoDigests }}{{ println . }}{{ end }}' \
    "$candidate_id" | grep --fixed-strings --line-regexp --quiet \
    --regexp="$application_image" --regexp="$migration_image"
}

while IFS= read -r container_id; do
  [[ -n "$container_id" ]] || continue
  if [[ "$dry_run" == "true" ]]; then
    echo "Would remove stopped Levi production container: $container_id"
  else
    docker container rm "$container_id" >/dev/null
    echo "Removed stopped Levi production container: $container_id"
  fi
done < <(
  docker ps --all --quiet \
    --filter 'label=com.docker.compose.project=levi-production' \
    --filter 'status=created' \
    --filter 'status=exited' \
    --filter 'status=dead' | sort --unique
)

while IFS= read -r image_id; do
  [[ -n "$image_id" ]] || continue
  if is_running_image "$image_id" || references_current_digest "$image_id"; then
    continue
  fi
  if [[ "$dry_run" == "true" ]]; then
    echo "Would remove obsolete Levi image: $image_id"
  else
    docker image rm "$image_id" >/dev/null
    echo "Removed obsolete Levi image: $image_id"
  fi
done < <(
  {
    docker image ls ghcr.io/iwaseasahi/levi --quiet --no-trunc
    docker image ls ghcr.io/iwaseasahi/levi-migrate --quiet --no-trunc
  } | sort --unique
)

if [[ "$dry_run" == "true" ]]; then
  echo "Dry-run completed; no Docker object was changed."
else
  docker image prune --force >/dev/null
  echo "Removed unused dangling image data."
fi

echo "Docker disk usage after scoped cleanup:"
docker system df
echo "Production Docker image cleanup completed; current and running images were preserved."
