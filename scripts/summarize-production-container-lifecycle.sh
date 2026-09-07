#!/usr/bin/env bash
set -euo pipefail

readonly start_epoch="${1:-}"
readonly end_epoch="${2:-}"
readonly max_gap_seconds=180

if [[ ! "$start_epoch" =~ ^[0-9]+$ ]] || [[ ! "$end_epoch" =~ ^[0-9]+$ ]] ||
  (( start_epoch <= 0 || end_epoch <= start_epoch )); then
  echo "Usage: summarize-production-container-lifecycle.sh START_EPOCH END_EPOCH" >&2
  exit 2
fi
if [[ "${EUID}" -ne 0 && "${LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL:-false}" != "true" ]]; then
  echo "Production container lifecycle summaries must run as root." >&2
  exit 2
fi

summarize() {
  awk \
    -v start="$start_epoch" \
    -v end="$end_epoch" \
    -v max_gap="$max_gap_seconds" '
    BEGIN {
      services[1] = "proxy"
      services[2] = "app"
      services[3] = "postgres"
      prefix = "Production container lifecycle:"
    }
    index($0, prefix) == 1 {
      if (NF != 10 || $1 != "Production" || $2 != "container" || $3 != "lifecycle:") {
        invalid = 1
        next
      }
      delete values
      for (field = 4; field <= 10; field++) {
        separator = index($field, "=")
        if (separator <= 1) {
          invalid = 1
          next
        }
        key = substr($field, 1, separator - 1)
        value = substr($field, separator + 1)
        if (key in values) invalid = 1
        values[key] = value
      }
      service = values["service"]
      generation = values["generation"]
      started_at = values["started_at"]
      restart_count = values["restart_count"]
      event = values["event"]
      coverage = values["coverage_started_at_epoch"]
      observed = values["observed_at_epoch"]
      if (!(service == "proxy" || service == "app" || service == "postgres") ||
        generation !~ /^[0-9]+$/ || generation < 1 ||
        started_at !~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9](\.[0-9]+)?Z$/ ||
        restart_count !~ /^[0-9]+$/ ||
        !(event == "initialized" || event == "steady" || event == "restart" || event == "replacement") ||
        coverage !~ /^[0-9]+$/ || coverage < 1 ||
        observed !~ /^[0-9]+$/ || observed < 1) {
        invalid = 1
        next
      }
      generation += 0
      restart_count += 0
      coverage += 0
      observed += 0
      if (observed < start || observed > end) next

      if (sample_count[service] > 0) {
        if (observed <= last_observed[service]) invalid = 1
        gap = observed - last_observed[service]
        if (gap > largest_gap[service]) largest_gap[service] = gap
        if (generation < last_generation[service] || generation > last_generation[service] + 1) invalid = 1
        if (generation == last_generation[service] && restart_count < last_restart_count[service]) invalid = 1
        if (event == "replacement" && generation != last_generation[service] + 1) invalid = 1
        if (event != "replacement" && generation != last_generation[service]) invalid = 1
        if (event == "steady" && (started_at != last_started_at[service] || restart_count != last_restart_count[service])) invalid = 1
        if (event == "restart" && started_at == last_started_at[service] && restart_count == last_restart_count[service]) invalid = 1
        if (event == "initialized") invalid = 1
        if (coverage != last_coverage_start[service]) invalid = 1
      } else {
        first_observed[service] = observed
        first_generation[service] = generation
        first_restart_count[service] = restart_count
      }
      sample_count[service]++
      if (coverage > latest_coverage_start[service]) latest_coverage_start[service] = coverage
      if (event == "replacement") replacements[service]++
      if (event == "restart") restarts[service]++
      last_observed[service] = observed
      last_generation[service] = generation
      last_restart_count[service] = restart_count
      last_started_at[service] = started_at
      last_coverage_start[service] = coverage
    }
    END {
      if (invalid) {
        print "Container lifecycle history contains an invalid record." > "/dev/stderr"
        exit 2
      }
      result = 0
      printf "Production container lifecycle period: start_epoch=%d end_epoch=%d max_gap_seconds=%d\n", start, end, max_gap
      for (i = 1; i <= 3; i++) {
        service = services[i]
        coverage_status = "complete"
        reason = "none"
        if (sample_count[service] == 0) {
          coverage_status = "insufficient"
          reason = "no_samples"
        } else if (latest_coverage_start[service] > start) {
          coverage_status = "insufficient"
          reason = "coverage_started_after_period"
        } else if (first_observed[service] > start + max_gap) {
          coverage_status = "insufficient"
          reason = "missing_start_boundary"
        } else if (last_observed[service] < end - max_gap) {
          coverage_status = "insufficient"
          reason = "missing_end_boundary"
        } else if (largest_gap[service] > max_gap) {
          coverage_status = "insufficient"
          reason = "sample_gap"
        }
        if (coverage_status == "insufficient") result = 1
        printf "Production container lifecycle summary: service=%s coverage=%s reason=%s samples=%d replacements=%d restarts=%d generation_start=%d generation_end=%d restart_count_start=%d restart_count_end=%d\n", service, coverage_status, reason, sample_count[service], replacements[service], restarts[service], first_generation[service], last_generation[service], first_restart_count[service], last_restart_count[service]
      }
      exit result
    }
  '
}

if [[ "${LEVI_ALLOW_TEST_OVERRIDES:-false}" == "true" &&
  -n "${LEVI_LIFECYCLE_JOURNAL_FILE:-}" ]]; then
  summarize <"$LEVI_LIFECYCLE_JOURNAL_FILE"
  exit $?
fi

readonly query_start="$((start_epoch > max_gap_seconds ? start_epoch - max_gap_seconds : 0))"
readonly query_end="$((end_epoch + max_gap_seconds))"
set +e
journalctl --quiet --unit levi-health.service \
  --since "@${query_start}" --until "@${query_end}" --output=cat 2>/dev/null | summarize
readonly -a pipeline_status=("${PIPESTATUS[@]}")
set -e
if (( pipeline_status[0] != 0 )); then
  echo "Unable to read production container lifecycle history." >&2
  exit 1
fi
exit "${pipeline_status[1]}"
