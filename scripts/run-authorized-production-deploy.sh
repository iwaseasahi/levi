#!/usr/bin/env bash

set -euo pipefail

readonly repository="iwaseasahi/levi"
readonly workflow_path=".github/workflows/deploy-production.yml"
readonly ssh_host_alias="${LEVI_PRODUCTION_SSH_ALIAS:-levi-system-production}"

if [[ $# -ne 1 || ! "$1" =~ ^[0-9]+$ ]]; then
  echo "Usage: pnpm production:deploy:authorized -- RUN_ID" >&2
  exit 64
fi

for command in gh jq ssh; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command is unavailable: $command" >&2
    exit 69
  }
done

readonly run_id="$1"
readonly temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/levi-production-authorization.XXXXXX")"
trap 'rm -rf "$temporary_directory"' EXIT

run_json="$(gh api "repos/${repository}/actions/runs/${run_id}")"
readonly run_json

[[ "$(jq -r '.event' <<<"$run_json")" == "workflow_dispatch" ]] || {
  echo "The GitHub Actions run was not manually dispatched." >&2
  exit 65
}
[[ "$(jq -r '.status' <<<"$run_json")" == "completed" ]] || {
  echo "The GitHub Actions run has not completed." >&2
  exit 65
}
[[ "$(jq -r '.conclusion' <<<"$run_json")" == "success" ]] || {
  echo "The GitHub Actions run did not succeed." >&2
  exit 65
}
[[ "$(jq -r '.head_branch' <<<"$run_json")" == "main" ]] || {
  echo "The authorization workflow did not run from main." >&2
  exit 65
}

readonly workflow_id="$(jq -r '.workflow_id' <<<"$run_json")"
readonly run_attempt="$(jq -r '.run_attempt' <<<"$run_json")"
readonly actual_workflow_path="$(gh api "repos/${repository}/actions/workflows/${workflow_id}" --jq '.path')"
[[ "$actual_workflow_path" == "$workflow_path" ]] || {
  echo "The run is not from the production authorization workflow." >&2
  exit 65
}

readonly artifact_name="production-deploy-authorization-${run_id}-${run_attempt}"
gh run download "$run_id" \
  --repo "$repository" \
  --name "$artifact_name" \
  --dir "$temporary_directory"

readonly authorization_file="${temporary_directory}/production-deploy-authorization.json"
[[ -f "$authorization_file" ]] || {
  echo "The production authorization record is unavailable or expired." >&2
  exit 66
}

jq -e \
  --arg repository "$repository" \
  --argjson run_id "$run_id" \
  --argjson run_attempt "$run_attempt" \
  '.schema_version == 3 and
   .repository == $repository and
   .run_id == $run_id and
   .run_attempt == $run_attempt and
   (.commit_sha | test("^[a-f0-9]{40}$")) and
   (.application_image | test("^ghcr\\.io/iwaseasahi/levi@sha256:[a-f0-9]{64}$")) and
   (.migration_image | test("^ghcr\\.io/iwaseasahi/levi-migrate@sha256:[a-f0-9]{64}$")) and
   (.approval_comment | test("^https://github\\.com/iwaseasahi/levi/issues/[0-9]+#issuecomment-[0-9]+$")) and
   ((.sunday_approval_comment == null) or (.sunday_approval_comment | test("^https://github\\.com/iwaseasahi/levi/issues/[0-9]+#issuecomment-[0-9]+$"))) and
   (.release_candidate_run_id | type == "number") and
   (.authorized_at | type == "string")' \
  "$authorization_file" >/dev/null || {
  echo "The production authorization record is invalid." >&2
  exit 65
}

readonly commit_sha="$(jq -r '.commit_sha' "$authorization_file")"
readonly application_image="$(jq -r '.application_image' "$authorization_file")"
readonly migration_image="$(jq -r '.migration_image' "$authorization_file")"
readonly approval_comment="$(jq -r '.approval_comment' "$authorization_file")"
readonly sunday_approval_comment="$(jq -r '.sunday_approval_comment // "none"' "$authorization_file")"

echo "Authorization verified: ${repository} Actions run ${run_id}, attempt ${run_attempt}."
echo "Connecting through the operator's allowlisted SSH path."
ssh -o BatchMode=yes "$ssh_host_alias" \
  "sudo -n /usr/local/sbin/levi-production-deploy '$commit_sha' '$application_image' '$migration_image' '$approval_comment' '$sunday_approval_comment'"
