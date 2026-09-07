#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly production_state_root="/var/lib/levi-monitoring"
readonly production_compose_project_name="levi-production"
readonly compose_file="${LEVI_COMPOSE_FILE:-/opt/levi/deploy/production/compose.yaml}"
readonly environment_file="${LEVI_ENV_FILE:-/etc/levi/production.env}"
readonly -a services=(proxy app postgres)

if [[ "${EUID}" -ne 0 && "${LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL:-false}" != "true" ]]; then
  echo "Production container lifecycle recording must run as root." >&2
  exit 2
fi

state_root="$production_state_root"
compose_project_name="$production_compose_project_name"
observed_at_epoch="$(date -u +%s)"
if [[ "${LEVI_ALLOW_TEST_OVERRIDES:-false}" == "true" ]]; then
  state_root="${LEVI_MONITORING_STATE_ROOT:-$state_root}"
  compose_project_name="${LEVI_COMPOSE_PROJECT_NAME:-$compose_project_name}"
  observed_at_epoch="${LEVI_LIFECYCLE_OBSERVED_AT_EPOCH:-$observed_at_epoch}"
fi
readonly state_root compose_project_name observed_at_epoch

if [[ ! "$observed_at_epoch" =~ ^[0-9]+$ ]] || (( observed_at_epoch <= 0 )); then
  echo "Container lifecycle observation time is invalid." >&2
  exit 2
fi

mkdir -p "$state_root"
chmod 700 "$state_root"
readonly lock_directory="${state_root}/.container-lifecycle.lock"
if ! mkdir "$lock_directory" 2>/dev/null; then
  echo "Another container lifecycle recorder is already running." >&2
  exit 1
fi
cleanup() {
  rmdir "$lock_directory" 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM

compose() {
  docker compose --project-name "$compose_project_name" \
    --env-file "$environment_file" --file "$compose_file" "$@"
}

valid_timestamp() {
  [[ "$1" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$ ]]
}

for service in "${services[@]}"; do
  if ! container_id="$(compose ps --quiet "$service" 2>/dev/null)" ||
    [[ -z "$container_id" || "$container_id" == *$'\n'* ]]; then
    echo "Unable to identify the production ${service} container." >&2
    exit 1
  fi
  if ! inspection="$(docker inspect --format \
    '{{.Created}}|{{.State.StartedAt}}|{{.RestartCount}}' \
    "$container_id" 2>/dev/null)"; then
    echo "Unable to inspect the production ${service} lifecycle." >&2
    exit 1
  fi
  IFS='|' read -r created_at started_at restart_count extra <<<"$inspection"
  if [[ -n "${extra:-}" ]] || ! valid_timestamp "$created_at" ||
    ! valid_timestamp "$started_at" || [[ ! "$restart_count" =~ ^[0-9]+$ ]]; then
    echo "The production ${service} lifecycle is invalid." >&2
    exit 1
  fi

  state_file="${state_root}/container-${service}.json"
  generation=1
  coverage_started_at_epoch="$observed_at_epoch"
  event="initialized"
  if [[ -e "$state_file" ]]; then
    if [[ -L "$state_file" || ! -f "$state_file" ]] ||
      ! jq -e --arg service "$service" --argjson observed "$observed_at_epoch" '
      type == "object"
      and (keys | sort) == ([
        "coverage_started_at_epoch",
        "created_at",
        "generation",
        "restart_count",
        "schema_version",
        "service",
        "started_at"
      ] | sort)
      and .schema_version == 1
      and .service == $service
      and (.generation | type) == "number"
      and .generation >= 1
      and (.generation | floor) == .generation
      and (.created_at | type) == "string"
      and (.created_at | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?Z$"))
      and (.started_at | type) == "string"
      and (.started_at | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?Z$"))
      and (.restart_count | type) == "number"
      and .restart_count >= 0
      and (.restart_count | floor) == .restart_count
      and (.coverage_started_at_epoch | type) == "number"
      and .coverage_started_at_epoch > 0
      and .coverage_started_at_epoch <= $observed
      and (.coverage_started_at_epoch | floor) == .coverage_started_at_epoch
    ' "$state_file" >/dev/null 2>&1; then
      echo "Stored production ${service} lifecycle state is invalid." >&2
      exit 1
    fi

    IFS=$'\t' read -r previous_generation previous_created_at \
      previous_started_at previous_restart_count coverage_started_at_epoch < <(
      jq -r '[
        .generation,
        .created_at,
        .started_at,
        .restart_count,
        .coverage_started_at_epoch
      ] | @tsv' "$state_file"
    )
    generation="$previous_generation"
    event="steady"
    if [[ "$created_at" != "$previous_created_at" ]]; then
      generation="$((previous_generation + 1))"
      event="replacement"
    elif (( restart_count < previous_restart_count )); then
      echo "The production ${service} restart counter moved backwards." >&2
      exit 1
    elif [[ "$started_at" != "$previous_started_at" ]] ||
      (( restart_count > previous_restart_count )); then
      event="restart"
    fi
  fi

  temporary_state="${state_file}.tmp.$$"
  if ! jq -n \
    --arg service "$service" \
    --arg created_at "$created_at" \
    --arg started_at "$started_at" \
    --argjson generation "$generation" \
    --argjson restart_count "$restart_count" \
    --argjson coverage_started_at_epoch "$coverage_started_at_epoch" \
    '{
      schema_version: 1,
      service: $service,
      generation: $generation,
      created_at: $created_at,
      started_at: $started_at,
      restart_count: $restart_count,
      coverage_started_at_epoch: $coverage_started_at_epoch
    }' >"$temporary_state"; then
    rm -f "$temporary_state"
    echo "Unable to encode production ${service} lifecycle state." >&2
    exit 1
  fi
  chmod 600 "$temporary_state"
  mv "$temporary_state" "$state_file"

  printf '%s\n' \
    "Production container lifecycle: service=${service} generation=${generation} started_at=${started_at} restart_count=${restart_count} event=${event} coverage_started_at_epoch=${coverage_started_at_epoch} observed_at_epoch=${observed_at_epoch}"
done
