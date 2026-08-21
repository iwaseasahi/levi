#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${repository_root}/deploy/production/compose.yaml"
environment_file="${repository_root}/deploy/production/production.env.example"
project_name="levi-production-rehearsal"
export LEVI_IMAGE="levi-production:rehearsal"

compose() {
  docker compose \
    --project-name "${project_name}" \
    --env-file "${environment_file}" \
    --file "${compose_file}" \
    "$@"
}

cleanup() {
  compose down --volumes --remove-orphans --rmi local >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
compose build app
compose up --detach --wait postgres app

compose exec --no-TTY app node -e \
  "if(process.getuid?.()!==1000)throw new Error('app is not running as uid 1000')"
compose exec --no-TTY app node -e \
  "require('node:fs').writeFileSync('/tmp/levi-read-write-probe','ok')"
if compose exec --no-TTY app node -e \
  "require('node:fs').writeFileSync('/levi-read-only-probe','unexpected')" \
  >/dev/null 2>&1; then
  echo "Application root filesystem was writable." >&2
  exit 1
fi
compose exec --no-TTY app node -e \
  "fetch('http://127.0.0.1:3000/api/ready').then(async response=>{if(!response.ok)throw new Error(await response.text());console.log(await response.text())})"

echo "Production application and PostgreSQL rehearsal passed."
