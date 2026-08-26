#!/usr/bin/env bash

set -euo pipefail

readonly repository="iwaseasahi/levi"
readonly publish_workflow_path=".github/workflows/publish-production-images.yml"
readonly authorize_workflow_path=".github/workflows/deploy-production.yml"
readonly script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "--" ]]; then
  shift
fi
if [[ $# -ne 1 || ! "$1" =~ ^[0-9]+$ ]]; then
  echo "Usage: pnpm production:release:deploy -- PUBLISH_RUN_ID" >&2
  exit 64
fi
for command in gh jq; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command is unavailable: $command" >&2
    exit 69
  }
done

readonly publish_run_id="$1"
readonly temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/levi-production-release.XXXXXX")"
trap 'rm -rf "$temporary_directory"' EXIT

publish_run_json="$(gh api "repos/${repository}/actions/runs/${publish_run_id}")"
[[ "$(jq -r '.event' <<< "$publish_run_json")" == "workflow_dispatch" ]] || {
  echo "The candidate workflow was not manually dispatched." >&2
  exit 65
}
[[ "$(jq -r '.status' <<< "$publish_run_json")" == "completed" &&
  "$(jq -r '.conclusion' <<< "$publish_run_json")" == "success" ]] || {
  echo "The candidate workflow has not completed successfully." >&2
  exit 65
}
[[ "$(jq -r '.head_branch' <<< "$publish_run_json")" == "main" ]] || {
  echo "The candidate workflow did not run from main." >&2
  exit 65
}
readonly publish_workflow_id="$(jq -r '.workflow_id' <<< "$publish_run_json")"
readonly actual_publish_workflow="$(gh api "repos/${repository}/actions/workflows/${publish_workflow_id}" --jq '.path')"
[[ "$actual_publish_workflow" == "$publish_workflow_path" ]] || {
  echo "The supplied run is not a production image candidate workflow." >&2
  exit 65
}

readonly publish_run_attempt="$(jq -r '.run_attempt' <<< "$publish_run_json")"
gh run download "$publish_run_id" \
  --repo "$repository" \
  --name "production-release-candidate-${publish_run_id}-${publish_run_attempt}" \
  --dir "$temporary_directory"
readonly candidate_file="${temporary_directory}/production-release-candidate.json"
[[ -f "$candidate_file" ]] || {
  echo "The production release candidate is unavailable or expired." >&2
  exit 66
}
jq -e \
  --arg repository "$repository" \
  --argjson run_id "$publish_run_id" \
  --argjson run_attempt "$publish_run_attempt" \
  '.schema_version == 1 and
   .repository == $repository and
   .run_id == $run_id and
   .run_attempt == $run_attempt and
   (.commit_sha | test("^[a-f0-9]{40}$")) and
   (.application_image | test("^ghcr\\.io/iwaseasahi/levi@sha256:[a-f0-9]{64}$")) and
   (.migration_image | test("^ghcr\\.io/iwaseasahi/levi-migrate@sha256:[a-f0-9]{64}$")) and
   (.prepared_at | type == "string")' \
  "$candidate_file" >/dev/null || {
  echo "The production release candidate is invalid." >&2
  exit 65
}

readonly commit_sha="$(jq -r '.commit_sha' "$candidate_file")"
readonly application_image="$(jq -r '.application_image' "$candidate_file")"
readonly migration_image="$(jq -r '.migration_image' "$candidate_file")"

readonly dispatched_after="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
readonly expected_title="Authorize production candidate #${publish_run_id}"
gh workflow run "$authorize_workflow_path" \
  --repo "$repository" \
  --ref main \
  --field "release_candidate_run_id=${publish_run_id}"

authorization_run_id=""
for _ in {1..30}; do
  runs_json="$(gh run list \
    --repo "$repository" \
    --workflow "$authorize_workflow_path" \
    --event workflow_dispatch \
    --branch main \
    --limit 50 \
    --json databaseId,createdAt,displayTitle)"
  authorization_run_id="$(jq -r \
    --arg expected_title "$expected_title" \
    --arg dispatched_after "$dispatched_after" \
    '[.[] | select(.displayTitle == $expected_title and .createdAt >= $dispatched_after)] | sort_by(.databaseId) | last | .databaseId // empty' \
    <<< "$runs_json")"
  [[ -n "$authorization_run_id" ]] && break
  sleep 2
done
[[ "$authorization_run_id" =~ ^[0-9]+$ ]] || {
  echo "The production authorization workflow run could not be identified safely." >&2
  exit 66
}

echo "Exact candidate verified: commit=${commit_sha} application=${application_image} migration=${migration_image}"
echo "Approve the protected production Environment when prompted. Sunday additionally requires production-sunday approval:"
echo "https://github.com/${repository}/actions/runs/${authorization_run_id}"
gh run watch "$authorization_run_id" --repo "$repository" --exit-status

bash "${script_directory}/run-authorized-production-deploy.sh" "$authorization_run_id"
