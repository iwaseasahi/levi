#!/usr/bin/env bash

set -euo pipefail

readonly repository="iwaseasahi/levi"
readonly workflow_path=".github/workflows/publish-production-images.yml"

if [[ $# -ne 1 || ! "$1" =~ ^[0-9]+$ ]]; then
  echo "Usage: pnpm production:release:prepare -- ISSUE_NUMBER" >&2
  exit 64
fi

for command in gh git jq; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command is unavailable: $command" >&2
    exit 69
  }
done

readonly release_issue="$1"
readonly temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/levi-production-candidate.XXXXXX")"
trap 'rm -rf "$temporary_directory"' EXIT

issue_state="$(gh api "repos/${repository}/issues/${release_issue}" --jq '.state')"
[[ "$issue_state" == "open" ]] || {
  echo "Release Issue #${release_issue} must exist and be open." >&2
  exit 65
}

git fetch --quiet origin main
readonly commit_sha="$(git rev-parse origin/main)"
[[ "$commit_sha" =~ ^[a-f0-9]{40}$ ]] || {
  echo "Unable to resolve origin/main to an exact commit." >&2
  exit 65
}

for required in Quality Database E2E Security; do
  result="$(gh api "repos/${repository}/commits/${commit_sha}/check-runs?per_page=100" \
    --jq "[.check_runs[] | select(.name == \"$required\")] | sort_by(.started_at) | last | [.status, .conclusion] | @tsv")"
  [[ "$result" == $'completed\tsuccess' ]] || {
    echo "Latest ${required} check is not successful for pinned main commit ${commit_sha}." >&2
    exit 65
  }
done

readonly dispatched_after="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
readonly expected_title="Prepare production candidate #${release_issue} for ${commit_sha}"
gh workflow run "$workflow_path" \
  --repo "$repository" \
  --ref main \
  --field "commit_sha=${commit_sha}" \
  --field "release_issue=${release_issue}"

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
  --argjson release_issue "$release_issue" \
  --arg commit_sha "$commit_sha" \
  '.schema_version == 1 and
   .repository == $repository and
   .run_id == $run_id and
   .run_attempt == $run_attempt and
   .release_issue == $release_issue and
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
readonly comment_file="${temporary_directory}/release-candidate-comment.md"
{
  echo "## Production release candidate"
  echo
  echo "現在の \`origin/main\` を準備開始時に固定し、immutable imageを公開しました。"
  echo
  echo "- Candidate run: [${run_id}](https://github.com/${repository}/actions/runs/${run_id})"
  echo "- Commit: \`${commit_sha}\`"
  echo "- Application: \`${application_image}\`"
  echo "- Migration: \`${migration_image}\`"
  echo
  echo "内容、migration、backup、利用者影響、実施時刻、forward recoveryを確認し、承認する場合は別コメントへ次の4行をそのまま記載してください。"
  echo
  echo '```text'
  echo "Production-Deploy: APPROVED"
  echo "Commit: ${commit_sha}"
  echo "Application-Image: ${application_image}"
  echo "Migration-Image: ${migration_image}"
  echo '```'
  echo
  echo "日曜（Asia/Tokyo）にdeployする場合は、上の4行の末尾へ \`Sunday-Deploy: APPROVED\` を追加してください。"
} > "$comment_file"

candidate_comment_url="$(gh issue comment "$release_issue" \
  --repo "$repository" \
  --body-file "$comment_file")"
readonly candidate_comment_url

echo "Release candidate recorded: ${candidate_comment_url}"
echo "After the repository owner posts the exact approval comment, run:"
echo "mise exec -- pnpm production:release:deploy -- ${run_id}"
