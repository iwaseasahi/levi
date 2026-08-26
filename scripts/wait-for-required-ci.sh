#!/usr/bin/env bash

set -euo pipefail

readonly repository="${GITHUB_REPOSITORY:-iwaseasahi/levi}"

if [[ $# -ne 1 || ! "$1" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Usage: wait-for-required-ci.sh COMMIT_SHA" >&2
  exit 64
fi
for command in gh jq; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command is unavailable: $command" >&2
    exit 69
  }
done

readonly commit_sha="$1"
max_attempts=180
interval_seconds=10
if [[ "${LEVI_ALLOW_TEST_OVERRIDES:-false}" == "true" ]]; then
  max_attempts="${LEVI_CI_WAIT_MAX_ATTEMPTS:-$max_attempts}"
  interval_seconds="${LEVI_CI_WAIT_INTERVAL_SECONDS:-$interval_seconds}"
fi
[[ "$max_attempts" =~ ^[1-9][0-9]*$ ]] || {
  echo "CI wait attempts must be a positive integer." >&2
  exit 64
}
[[ "$interval_seconds" =~ ^[0-9]+$ ]] || {
  echo "CI wait interval must be a non-negative integer." >&2
  exit 64
}

readonly required_checks=(Quality Database E2E Security)
for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
  checks_json="$(gh api "repos/${repository}/commits/${commit_sha}/check-runs?per_page=100")"
  pending=()

  for required in "${required_checks[@]}"; do
    result="$(jq -r \
      --arg required "$required" \
      '[.check_runs[] | select(.name == $required)] | sort_by(.started_at) | last | [(.status // "missing"), (.conclusion // "")] | @tsv' \
      <<< "$checks_json")"
    IFS=$'\t' read -r status conclusion <<< "$result"
    status="${status:-missing}"
    conclusion="${conclusion:-}"

    if [[ "$status" == "completed" && "$conclusion" == "success" ]]; then
      continue
    fi
    if [[ "$status" == "completed" ]]; then
      echo "Latest ${required} check failed for ${commit_sha}: conclusion=${conclusion:-unknown}." >&2
      exit 65
    fi
    pending+=("${required}:${status}")
  done

  if [[ ${#pending[@]} -eq 0 ]]; then
    echo "Required CI passed for ${commit_sha}."
    exit 0
  fi
  if ((attempt == max_attempts)); then
    break
  fi
  echo "Waiting for required CI (${attempt}/${max_attempts}): ${pending[*]}"
  sleep "$interval_seconds"
done

echo "Timed out waiting for required CI on ${commit_sha}." >&2
exit 75
