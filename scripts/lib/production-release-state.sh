#!/usr/bin/env bash

# Non-secret release metadata only. Never read production runtime credentials.
read_ready_production_deployment() {
  local deployment_json
  deployment_json="$(gh api repos/iwaseasahi/levi/actions/variables/LEVI_PRODUCTION_DEPLOYMENT --jq .value)" || return
  if ! jq -e '
    .schema_version == 1 and .status == "ready" and
    (.commit_sha | test("^[a-f0-9]{40}$")) and
    (.application_image | test("^ghcr\\.io/iwaseasahi/levi@sha256:[a-f0-9]{64}$")) and
    (.migration_image | test("^ghcr\\.io/iwaseasahi/levi-migrate@sha256:[a-f0-9]{64}$")) and
    (.authorization_run_url | test("^https://github\\.com/iwaseasahi/levi/actions/runs/[0-9]+$")) and
    (.recorded_at | fromdateiso8601 | type == "number")
  ' <<<"$deployment_json" >/dev/null 2>&1; then
    echo "Production deployment state must be valid and ready; automatic deployment stopped." >&2
    return 65
  fi
  jq -cS '{schema_version,status,commit_sha,application_image,migration_image,authorization_run_url,recorded_at}' <<<"$deployment_json"
}

is_unattended_deployment() {
  case "${LEVI_UNATTENDED_DEPLOYMENT:-false}" in
    true) return 0 ;;
    false) return 1 ;;
    *) echo "LEVI_UNATTENDED_DEPLOYMENT must be true or false." >&2; exit 64 ;;
  esac
}

require_unattended_context() {
  if is_unattended_deployment; then
    [[ "$(TZ=Asia/Tokyo date +%u)" == "2" ]] || {
      echo "Unattended production deployment is authorized only on Tuesday in Asia/Tokyo." >&2
      exit 75
    }
    [[ "${LEVI_UNATTENDED_EXPECTED_COMMIT:-}" =~ ^[a-f0-9]{40}$ &&
      -n "${LEVI_UNATTENDED_EXPECTED_DEPLOYMENT:-}" ]] || {
      echo "Unattended deployment requires the pinned commit and previous ready deployment." >&2
      exit 64
    }
  fi
}

record_deployment_state() {
  local status="$1"
  local recorded_at
  local state_json
  recorded_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  state_json="$(jq -cn \
    --arg status "$status" \
    --arg commit_sha "$commit_sha" \
    --arg application_image "$application_image" \
    --arg migration_image "$migration_image" \
    --arg authorization_run_url "$authorization_run_url" \
    --arg recorded_at "$recorded_at" \
    '{
      schema_version: 1,
      status: $status,
      commit_sha: $commit_sha,
      application_image: $application_image,
      migration_image: $migration_image,
      authorization_run_url: $authorization_run_url,
      recorded_at: $recorded_at
    }')"
  gh variable set LEVI_PRODUCTION_DEPLOYMENT \
    --repo "$repository" \
    --body "$state_json"
}

# Non-secret host history only; never source environment files as code.
require_matching_host_history() {
  local deployment="$1" history_file="$2" field host_value json_field
  for field in commit application_image migration_image; do
    host_value="$(sed -n "s/^${field}=//p" "$history_file")" || return
    json_field="$field"; [[ "$field" != commit ]] || json_field=commit_sha
    [[ -n "$host_value" && "$host_value" == "$(jq -r --arg field "$json_field" '.[$field]' <<<"$deployment")" ]] || {
      echo "Host history and ready deployment metadata disagree." >&2; return 75;
    }
  done
}
