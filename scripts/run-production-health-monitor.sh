#!/usr/bin/env bash
set -uo pipefail

readonly webhook_url="${LEVI_SLACK_WEBHOOK_URL:-}"
readonly production_state_root="/var/lib/levi-monitoring"
readonly production_health_script="/opt/levi/scripts/check-production-health.sh"

if [[ "${EUID}" -ne 0 && "${LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL:-false}" != "true" ]]; then
  echo "Production health monitoring must run as root." >&2
  exit 2
fi

state_root="$production_state_root"
health_script="$production_health_script"
if [[ "${LEVI_ALLOW_TEST_OVERRIDES:-false}" == "true" ]]; then
  state_root="${LEVI_MONITORING_STATE_ROOT:-$state_root}"
  health_script="${LEVI_HEALTH_CHECK_SCRIPT:-$health_script}"
fi
readonly state_root health_script
readonly incident_marker="${state_root}/health-failed"

mkdir -p "$state_root"
chmod 700 "$state_root"

notify_slack() {
  local message="$1"
  local payload

  if [[ -z "$webhook_url" ]]; then
    echo "Slack monitoring webhook is not configured; notification was skipped."
    return 0
  fi
  if [[ ! "$webhook_url" =~ ^https://hooks\.slack\.com/services/[A-Za-z0-9_/-]+$ ]]; then
    echo "LEVI_SLACK_WEBHOOK_URL must be a Slack Incoming Webhook URL." >&2
    return 2
  fi

  payload="$(jq -cn --arg text "$message" '{text: $text}')" || return
  curl --fail --silent --show-error --max-time 10 \
    --header "Content-Type: application/json" \
    --data "$payload" \
    "$webhook_url" >/dev/null
}

health_output="$(mktemp)"
trap 'rm -f "$health_output"' EXIT HUP INT TERM

if "$health_script" >"$health_output" 2>&1; then
  cat "$health_output"
  if [[ -f "$incident_marker" ]]; then
    if notify_slack ":large_green_circle: Levi productionの内部監視が復旧しました。"; then
      rm -f "$incident_marker"
      echo "Production health recovery notification completed."
    else
      echo "Production health recovered, but the Slack recovery notification failed." >&2
      exit 1
    fi
  fi
  exit 0
else
  health_status=$?
fi

cat "$health_output" >&2
if [[ ! -f "$incident_marker" ]]; then
  if notify_slack ":red_circle: Levi productionの内部監視で異常を検知しました。VPSのsystemd journalを確認してください。"; then
    : >"$incident_marker"
    chmod 600 "$incident_marker"
    echo "Production health incident notification completed." >&2
  else
    echo "Production health check and Slack incident notification both failed." >&2
  fi
fi
exit "$health_status"
