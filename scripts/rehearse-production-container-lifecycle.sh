#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly repository_root
readonly compose_file="${repository_root}/tests/fixtures/container-lifecycle/compose.yaml"
readonly environment_file="${repository_root}/deploy/production/production.env.example"
readonly project_name="levi-lifecycle-rehearsal-${$}"
readonly recorder="${repository_root}/scripts/record-production-container-lifecycle.sh"
readonly summarizer="${repository_root}/scripts/summarize-production-container-lifecycle.sh"
rehearsal_root="$(mktemp -d "${TMPDIR:-/tmp}/levi-lifecycle-rehearsal.XXXXXX")"
readonly rehearsal_root
readonly state_root="${rehearsal_root}/state"
readonly journal_file="${rehearsal_root}/journal"

compose() {
  docker compose --project-name "$project_name" \
    --env-file "$environment_file" --file "$compose_file" "$@"
}

cleanup() {
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  if [[ "$rehearsal_root" == "${TMPDIR:-/tmp}/levi-lifecycle-rehearsal."* ]]; then
    rm -rf -- "$rehearsal_root"
  fi
}
trap cleanup EXIT HUP INT TERM

record_at() {
  LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL=true \
    LEVI_ALLOW_TEST_OVERRIDES=true \
    LEVI_COMPOSE_FILE="$compose_file" \
    LEVI_COMPOSE_PROJECT_NAME="$project_name" \
    LEVI_ENV_FILE="$environment_file" \
    LEVI_LIFECYCLE_OBSERVED_AT_EPOCH="$1" \
    LEVI_MONITORING_STATE_ROOT="$state_root" \
    "$recorder" >>"$journal_file"
}

compose up --detach --quiet-pull >/dev/null
record_at 1000
record_at 1060
compose restart app >/dev/null
record_at 1120
compose up --detach --force-recreate app >/dev/null
record_at 1180
record_at 1240

summary="$(
  LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL=true \
    LEVI_ALLOW_TEST_OVERRIDES=true \
    LEVI_LIFECYCLE_JOURNAL_FILE="$journal_file" \
    "$summarizer" 1000 1240
)"
if [[ "$summary" != *"service=app coverage=complete reason=none samples=5 replacements=1 restarts=1 generation_start=1 generation_end=2"* ]]; then
  echo "Disposable lifecycle rehearsal did not distinguish restart and replacement." >&2
  exit 1
fi
if grep -Eiq 'container[_-]?id|image|environment|credential|secret' "$journal_file"; then
  echo "Disposable lifecycle rehearsal emitted a forbidden field." >&2
  exit 1
fi

printf '%s\n' "$summary"
echo "Disposable production container lifecycle rehearsal passed."
