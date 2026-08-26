#!/usr/bin/env bash

set -euo pipefail

readonly repository="iwaseasahi/levi"
readonly workflow_path=".github/workflows/publish-production-images.yml"
readonly script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -ne 0 ]]; then
  echo "Usage: pnpm production:release:prepare" >&2
  exit 64
fi

for command in gh git jq; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command is unavailable: $command" >&2
    exit 69
  }
done

readonly temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/levi-production-candidate.XXXXXX")"
trap 'rm -rf "$temporary_directory"' EXIT

git fetch --quiet origin main
readonly commit_sha="$(git rev-parse origin/main)"
[[ "$commit_sha" =~ ^[a-f0-9]{40}$ ]] || {
  echo "Unable to resolve origin/main to an exact commit." >&2
  exit 65
}

GITHUB_REPOSITORY="$repository" bash "${script_directory}/wait-for-required-ci.sh" "$commit_sha"

readonly dispatched_after="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
readonly expected_title="Prepare production candidate for ${commit_sha}"
gh workflow run "$workflow_path" \
  --repo "$repository" \
  --ref main \
  --field "commit_sha=${commit_sha}"

run_id=""
for _ in {1..30}; do
  runs_json="$(gh run list \
    --repo "$repository" \
    --workflow "$workflow_path" \
    --event workflow_dispatch \
    --branch main \
    --limit 50 \
    --json databaseId,createdAt,displayTitle)"
  run_id="$(jq -r \
    --arg expected_title "$expected_title" \
    --arg dispatched_after "$dispatched_after" \
    '[.[] | select(.displayTitle == $expected_title and .createdAt >= $dispatched_after)] | sort_by(.databaseId) | last | .databaseId // empty' \
    <<< "$runs_json")"
  [[ -n "$run_id" ]] && break
  sleep 2
done
[[ "$run_id" =~ ^[0-9]+$ ]] || {
  echo "The dispatched production image workflow run could not be identified safely." >&2
  exit 66
}
readonly run_id

echo "Pinned origin/main at ${commit_sha}."
echo "Waiting for immutable images: https://github.com/${repository}/actions/runs/${run_id}"
gh run watch "$run_id" --repo "$repository" --exit-status

run_json="$(gh api "repos/${repository}/actions/runs/${run_id}")"
readonly run_attempt="$(jq -r '.run_attempt' <<< "$run_json")"
readonly artifact_name="production-release-candidate-${run_id}-${run_attempt}"
gh run download "$run_id" \
  --repo "$repository" \
  --name "$artifact_name" \
  --dir "$temporary_directory"

readonly candidate_file="${temporary_directory}/production-release-candidate.json"
[[ -f "$candidate_file" ]] || {
  echo "The immutable production release candidate artifact is unavailable." >&2
  exit 66
}
jq -e \
  --arg repository "$repository" \
  --argjson run_id "$run_id" \
  --argjson run_attempt "$run_attempt" \
  --arg commit_sha "$commit_sha" \
  '.schema_version == 1 and
   .repository == $repository and
   .run_id == $run_id and
   .run_attempt == $run_attempt and
   .commit_sha == $commit_sha and
   (.application_image | test("^ghcr\\.io/iwaseasahi/levi@sha256:[a-f0-9]{64}$")) and
   (.migration_image | test("^ghcr\\.io/iwaseasahi/levi-migrate@sha256:[a-f0-9]{64}$")) and
   (.prepared_at | type == "string")' \
  "$candidate_file" >/dev/null || {
  echo "The production release candidate artifact is invalid." >&2
  exit 65
}

readonly application_image="$(jq -r '.application_image' "$candidate_file")"
readonly migration_image="$(jq -r '.migration_image' "$candidate_file")"
echo "Production release candidate prepared."
echo "Candidate run: https://github.com/${repository}/actions/runs/${run_id}"
echo "Commit: ${commit_sha}"
echo "Application: ${application_image}"
echo "Migration: ${migration_image}"
echo "After reviewing the exact release, run:"
echo "mise exec -- pnpm production:release:deploy -- ${run_id}"
