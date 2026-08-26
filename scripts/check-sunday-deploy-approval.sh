#!/usr/bin/env bash
set -euo pipefail

readonly commit_sha="${COMMIT_SHA:-}"
readonly application_image="${APPLICATION_IMAGE:-}"
readonly migration_image="${MIGRATION_IMAGE:-}"
readonly sunday_approval_comment="${SUNDAY_APPROVAL_COMMENT:-}"
readonly repository="${GITHUB_REPOSITORY:-iwaseasahi/levi}"

weekday="$(TZ=Asia/Tokyo date +%u)"
if [[ "${LEVI_ALLOW_TEST_OVERRIDES:-false}" == "true" ]]; then
  weekday="${LEVI_SUNDAY_CHECK_WEEKDAY_OVERRIDE:-$weekday}"
fi
if [[ ! "$weekday" =~ ^[1-7]$ ]]; then
  echo "Unable to determine a safe deployment weekday." >&2
  exit 1
fi

if [[ "$weekday" != "7" ]]; then
  if [[ -n "$sunday_approval_comment" ]]; then
    echo "Sunday approval must not be supplied outside Sunday in Asia/Tokyo." >&2
    exit 1
  fi
  echo "Sunday-specific approval is not required today."
  exit 0
fi

if [[ ! "$commit_sha" =~ ^[a-f0-9]{40}$ ]] ||
  [[ ! "$application_image" =~ ^ghcr\.io/iwaseasahi/levi@sha256:[a-f0-9]{64}$ ]] ||
  [[ ! "$migration_image" =~ ^ghcr\.io/iwaseasahi/levi-migrate@sha256:[a-f0-9]{64}$ ]]; then
  echo "Exact release artifacts are required for Sunday approval validation." >&2
  exit 1
fi
if [[ ! "$sunday_approval_comment" =~ ^https://github\.com/iwaseasahi/levi/issues/[0-9]+#issuecomment-[0-9]+$ ]]; then
  echo "Production deployment on Sunday requires an exact Sunday approval comment URL." >&2
  exit 1
fi

comment_id="${sunday_approval_comment##*issuecomment-}"
comment_json="$(gh api "repos/${repository}/issues/comments/${comment_id}")"
if [[ "$(jq -r '.author_association' <<< "$comment_json")" != "OWNER" ]]; then
  echo "Sunday deployment approval must be authored by the repository owner." >&2
  exit 1
fi

comment_body="$(jq -r '.body' <<< "$comment_json")"
for required_line in \
  "Sunday-Deploy: APPROVED" \
  "Commit: $commit_sha" \
  "Application-Image: $application_image" \
  "Migration-Image: $migration_image"; do
  if ! grep -Fqx -- "$required_line" <<< "$comment_body"; then
    echo "Sunday deployment approval does not match the exact release artifacts." >&2
    exit 1
  fi
done

echo "Exact Sunday deployment approval passed."
