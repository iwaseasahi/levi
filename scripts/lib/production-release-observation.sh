#!/usr/bin/env bash

# Observation is optional and cannot change a deployment result. No HTTP here.
release_observe() {
  [[ "$EUID" -eq 0 && "${LEVI_RELEASE_TRANSPORT:-}" == local &&
    "${LEVI_RELEASE_OBSERVATION_ID:-}" =~ ^[a-f0-9]{32}$ ]] || return 0
  if ! /usr/bin/python3 /usr/local/lib/levi-release/scripts/production-release-notifications.py \
    observe "$LEVI_RELEASE_OBSERVATION_ID" "$@" 2>/dev/null; then
    echo "Release notification observation unavailable; deployment checks remain authoritative." >&2
  fi
  return 0
}
