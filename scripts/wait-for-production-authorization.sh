#!/usr/bin/env bash

set -euo pipefail

readonly repository="iwaseasahi/levi"
readonly interval_seconds="${LEVI_AUTHORIZATION_WAIT_INTERVAL_SECONDS:-3}"

if [[ $# -ne 1 || ! "$1" =~ ^[0-9]+$ ]]; then
  echo "Usage: wait-for-production-authorization.sh RUN_ID" >&2
  exit 64
fi
[[ "$interval_seconds" =~ ^[0-9]+$ ]] || {
  echo "LEVI_AUTHORIZATION_WAIT_INTERVAL_SECONDS must be a non-negative integer." >&2
  exit 64
}
for command in gh jq; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command is unavailable: $command" >&2
    exit 69
  }
done

readonly run_id="$1"
readonly authorization_url="https://github.com/${repository}/actions/runs/${run_id}"
last_waiting_state=""

while true; do
  run_json="$(gh api "repos/${repository}/actions/runs/${run_id}")"
  status="$(jq -r '.status' <<< "$run_json")"
  conclusion="$(jq -r '.conclusion // ""' <<< "$run_json")"

  if [[ "$status" == "completed" ]]; then
    [[ "$conclusion" == "success" ]] || {
      echo "Production authorization workflow completed with: ${conclusion:-unknown}." >&2
      echo "GitHub Actions: ${authorization_url}" >&2
      exit 65
    }
    echo "GitHub Actionsのproduction検証が完了しました。deployを続行します。"
    echo "GitHub Actions: ${authorization_url}"
    break
  fi

  pending_json="$(gh api "repos/${repository}/actions/runs/${run_id}/pending_deployments")"
  pending_environments="$(jq -r '[.[].environment.name] | join(", ")' <<< "$pending_json")"
  if [[ -n "$pending_environments" ]]; then
    waiting_state="approval:${pending_environments}"
    if [[ "$waiting_state" != "$last_waiting_state" ]]; then
      echo "GitHub Actionsで ${pending_environments} Environment の日曜deploy承認を待っています。"
      echo "承認URL: ${authorization_url}"
      last_waiting_state="$waiting_state"
    fi
  else
    waiting_state="workflow:${status}"
    if [[ "$waiting_state" != "$last_waiting_state" ]]; then
      echo "GitHub Actionsのproduction検証処理を待っています（状態: ${status}）。"
      echo "確認URL: ${authorization_url}"
      last_waiting_state="$waiting_state"
    fi
  fi

  sleep "$interval_seconds"
done
