#!/usr/bin/env bash
set -euo pipefail

readonly commit_sha="${COMMIT_SHA:-}"
readonly application_image="${APPLICATION_IMAGE:-}"
readonly migration_image="${MIGRATION_IMAGE:-}"
readonly approval_comment="${PRODUCTION_APPROVAL_COMMENT:-${APPROVAL_COMMENT:-}}"
readonly repository="${GITHUB_REPOSITORY:-iwaseasahi/levi}"

if [[ ! "$commit_sha" =~ ^[a-f0-9]{40}$ ]] ||
  [[ ! "$application_image" =~ ^ghcr\.io/iwaseasahi/levi@sha256:[a-f0-9]{64}$ ]] ||
  [[ ! "$migration_image" =~ ^ghcr\.io/iwaseasahi/levi-migrate@sha256:[a-f0-9]{64}$ ]]; then
  echo "Exact release artifacts are required for production approval validation." >&2
  exit 1
fi
if [[ ! "$approval_comment" =~ ^https://github\.com/iwaseasahi/levi/issues/[0-9]+#issuecomment-[0-9]+$ ]]; then
  echo "Production deployment requires an exact approval comment URL." >&2
  exit 1
fi

comment_id="${approval_comment##*issuecomment-}"
comment_json="$(gh api "repos/${repository}/issues/comments/${comment_id}")"
if [[ "$(jq -r '.author_association' <<< "$comment_json")" != "OWNER" ]]; then
  echo "Production deployment approval must be authored by the repository owner." >&2
  exit 1
fi

comment_body="$(jq -r '.body' <<< "$comment_json" | sed 's/\r$//')"
readonly expected_approval="Production-Deploy: APPROVED
Commit: $commit_sha
Application-Image: $application_image
Migration-Image: $migration_image"
readonly expected_combined_sunday_approval="${expected_approval}
Sunday-Deploy: APPROVED"
if [[ "$comment_body" != "$expected_approval" &&
  "$comment_body" != "$expected_combined_sunday_approval" ]]; then
  echo "Production deployment approval does not match the exact release artifacts." >&2
  exit 1
fi

echo "Exact production deployment approval passed."
