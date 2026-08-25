#!/bin/bash
set -euo pipefail
umask 077

readonly operator="levi-system-operator"
readonly source_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly entrypoint_source="${source_directory}/production-deploy-entrypoint.sh"
readonly entrypoint_target="/usr/local/sbin/levi-production-deploy"
readonly sudoers_target="/etc/sudoers.d/levi-production-deploy"

if [[ "${EUID}" -ne 0 ]]; then
  echo "The production deployment entrypoint installer must run as root." >&2
  exit 2
fi
if [[ ! -f "$entrypoint_source" ]]; then
  echo "Production deployment entrypoint source is unavailable." >&2
  exit 1
fi
if ! /usr/bin/id "$operator" >/dev/null 2>&1; then
  echo "The approved production operator does not exist." >&2
  exit 1
fi
if [[ ! -x /usr/sbin/visudo ]]; then
  echo "visudo is required to validate the sudoers policy." >&2
  exit 1
fi

readonly temporary_sudoers="$(/usr/bin/mktemp)"
cleanup() {
  /usr/bin/rm -f "$temporary_sudoers"
}
trap cleanup EXIT

printf '%s ALL=(root) NOPASSWD: %s\n' "$operator" "$entrypoint_target" >"$temporary_sudoers"
/usr/bin/chmod 0440 "$temporary_sudoers"
/usr/sbin/visudo -cf "$temporary_sudoers" >/dev/null

/usr/bin/install -o root -g root -m 0755 "$entrypoint_source" "$entrypoint_target"
/usr/bin/install -o root -g root -m 0440 "$temporary_sudoers" "$sudoers_target"
/usr/sbin/visudo -cf "$sudoers_target" >/dev/null

echo "Installed the production deployment entrypoint and its command-scoped sudo policy."
