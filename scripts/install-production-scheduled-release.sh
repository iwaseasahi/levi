#!/bin/bash
set -euo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
[[ "$EUID" -eq 0 && $# -eq 1 && "$1" =~ ^[a-f0-9]{40}$ ]] || { echo "Usage (root): install-production-scheduled-release.sh MERGED_COMMIT_SHA" >&2; exit 64; }
readonly source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly bundle=/usr/local/lib/levi-release
for unit in levi-release.timer levi-release.service; do
  if systemctl is-active --quiet "$unit"; then echo "Stop the existing release timer/service before replacing trusted code." >&2; exit 75; fi
done
for command in /usr/bin/gh /usr/bin/git /usr/bin/jq /usr/bin/python3 /usr/bin/openssl /usr/bin/systemd-analyze; do
  [[ -x "$command" ]] || { echo "A required system dependency is missing." >&2; exit 69; }
done
[[ "$(git -C "$source_root" rev-parse HEAD)" == "$1" ]] || { echo "Installer source is not the reviewed exact commit." >&2; exit 65; }
case "$(git -C "$source_root" remote get-url origin)" in
  https://github.com/iwaseasahi/levi.git|git@github.com:iwaseasahi/levi.git) ;;
  *) echo "Installer origin is not canonical." >&2; exit 65 ;;
esac
git -C "$source_root" diff --quiet HEAD -- scripts deploy/production/systemd || { echo "Installer source has local changes." >&2; exit 65; }
git -C "$source_root" fetch --quiet origin main
git -C "$source_root" merge-base --is-ancestor "$1" origin/main || { echo "Installer commit is not merged to main." >&2; exit 65; }
# Provisioning is a separate approved operation; inspect permissions, never values.
[[ "$(stat -c '%u:%a:%F' /etc/levi/release-app.pem)" == '0:600:regular file' ]] || { echo "App key must be a root-owned mode-0600 regular file." >&2; exit 65; }
[[ "$(stat -c '%u:%a:%F' /etc/levi/release-app.json)" == '0:600:regular file' ]] || { echo "App config must be a root-owned mode-0600 regular file." >&2; exit 65; }
# Validate App identity and exact CI before changing installed files.
readonly validation_directory="$(mktemp -d)"
trap 'rm -rf "$validation_directory"' EXIT
install -m 0700 "${source_root}/scripts/production-release-gh.py" "${validation_directory}/gh"
PATH="${validation_directory}:$PATH" bash "${source_root}/scripts/wait-for-required-ci.sh" "$1"
# Serialize trusted bundle replacement with every manual/scheduled application.
mkdir -p /var/lib/levi-deploy
chmod 700 /var/lib/levi-deploy
readonly transaction_lock=/var/lib/levi-deploy/.transaction.lock
mkdir "$transaction_lock" 2>/dev/null || { echo "A host deploy transaction is active." >&2; exit 75; }
trap 'rm -rf "$validation_directory"; rmdir "$transaction_lock" 2>/dev/null || true' EXIT
install -d -o root -g root -m 0755 "${bundle}/scripts/lib" "${bundle}/bin"
for script in run-host-scheduled-production-release.sh run-scheduled-production-release.sh prepare-production-release.sh deploy-production-release.sh wait-for-required-ci.sh wait-for-production-authorization.sh run-authorized-production-deploy.sh lib/production-release-state.sh lib/production-authorization.sh; do
  git -C "$source_root" ls-files --error-unmatch "scripts/$script" >/dev/null
  install -o root -g root -m 0755 "${source_root}/scripts/$script" "${bundle}/scripts/$script"
done
install -o root -g root -m 0755 "${source_root}/scripts/production-release-gh.py" "${bundle}/bin/gh"
# Keep the existing operator-only sudoers policy; no new SSH/sudo identity.
bash "${source_root}/scripts/install-production-deploy-entrypoint.sh"
for unit in levi-release.service levi-release.timer; do
  install -o root -g root -m 0644 "${source_root}/deploy/production/systemd/$unit" "/etc/systemd/system/$unit"
done
printf '%s\n' "$1" > "${bundle}/installed-commit"
chmod 0644 "${bundle}/installed-commit"
systemd-analyze verify /etc/systemd/system/levi-release.service /etc/systemd/system/levi-release.timer
systemctl daemon-reload
echo "Installed the reviewed release bundle. Timer is NOT enabled or started."
echo "After approved preflight, enable only levi-release.timer; never start the release service as a test."
