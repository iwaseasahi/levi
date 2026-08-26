#!/usr/bin/env bash

set -euo pipefail

readonly owner="iwaseasahi"
readonly deployment_json="${LEVI_PRODUCTION_DEPLOYMENT_JSON:-}"
readonly dry_run="${LEVI_GHCR_CLEANUP_DRY_RUN:-true}"
readonly retention_days="${LEVI_GHCR_RETENTION_DAYS:-7}"

for command in gh jq date; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command is unavailable: $command" >&2
    exit 69
  }
done
if [[ "$dry_run" != "true" && "$dry_run" != "false" ]]; then
  echo "LEVI_GHCR_CLEANUP_DRY_RUN must be true or false." >&2
  exit 64
fi
if [[ ! "$retention_days" =~ ^[0-9]+$ ]] ||
  ((retention_days < 1 || retention_days > 90)); then
  echo "LEVI_GHCR_RETENTION_DAYS must be between 1 and 90." >&2
  exit 64
fi
if [[ -z "$deployment_json" ]]; then
  echo "LEVI_PRODUCTION_DEPLOYMENT_JSON is unavailable; no package version was deleted." >&2
  exit 65
fi

jq -e \
  '.schema_version == 1 and
   .status == "ready" and
   (.commit_sha | test("^[a-f0-9]{40}$")) and
   (.application_image | test("^ghcr\\.io/iwaseasahi/levi@sha256:[a-f0-9]{64}$")) and
   (.migration_image | test("^ghcr\\.io/iwaseasahi/levi-migrate@sha256:[a-f0-9]{64}$")) and
   (.authorization_run_url | test("^https://github\\.com/iwaseasahi/levi/actions/runs/[0-9]+$")) and
   (.recorded_at | type == "string")' \
  <<<"$deployment_json" >/dev/null || {
  echo "Production deployment state is not ready and valid; no package version was deleted." >&2
  exit 65
}

readonly cutoff="$(date -u -d "${retention_days} days ago" +%Y-%m-%dT%H:%M:%SZ)"
readonly application_digest="$(jq -r '.application_image | split("@") | last' <<<"$deployment_json")"
readonly migration_digest="$(jq -r '.migration_image | split("@") | last' <<<"$deployment_json")"

cleanup_package() {
  local package_name="$1"
  local protected_digest="$2"
  local versions_json
  local candidates=0
  local deleted=0

  versions_json="$(gh api --paginate --slurp \
    "/users/${owner}/packages/container/${package_name}/versions?per_page=100")"
  jq -e 'type == "array" and all(.[]; type == "array")' \
    <<<"$versions_json" >/dev/null || {
    echo "Unexpected GHCR response for ${package_name}; no version was deleted." >&2
    exit 65
  }

  while IFS=$'\t' read -r version_id digest created_at tags; do
    [[ -n "$version_id" ]] || continue
    if [[ "$digest" == "$protected_digest" ]]; then
      echo "keep package=${package_name} digest=${digest} reason=production"
      continue
    fi
    if [[ -z "$tags" ]]; then
      echo "keep package=${package_name} digest=${digest} reason=untagged-child-or-attestation"
      continue
    fi
    if [[ "$created_at" > "$cutoff" || "$created_at" == "$cutoff" ]]; then
      echo "keep package=${package_name} digest=${digest} tags=${tags} reason=retention-window"
      continue
    fi

    candidates=$((candidates + 1))
    if [[ "$dry_run" == "true" ]]; then
      echo "would-delete package=${package_name} version_id=${version_id} digest=${digest} tags=${tags} created_at=${created_at}"
      continue
    fi
    gh api --method DELETE \
      "/users/${owner}/packages/container/${package_name}/versions/${version_id}"
    deleted=$((deleted + 1))
    echo "deleted package=${package_name} version_id=${version_id} digest=${digest} tags=${tags} created_at=${created_at}"
  done < <(
    jq -r '.[][] |
      [(.id | tostring), .name, .created_at, (.metadata.container.tags | join(","))] |
      @tsv' <<<"$versions_json"
  )

  echo "summary package=${package_name} candidates=${candidates} deleted=${deleted} dry_run=${dry_run}"
}

echo "GHCR cleanup started: cutoff=${cutoff} dry_run=${dry_run}."
cleanup_package "levi" "$application_digest"
cleanup_package "levi-migrate" "$migration_digest"
echo "GHCR cleanup completed without deleting the production digests."
