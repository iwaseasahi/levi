#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker with Compose is required. Install and start Docker, then retry." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is unavailable. Install and start Docker, then retry." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker, then retry." >&2
  exit 1
fi

corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm local:env:prepare
corepack pnpm db:up:dev
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm db:seed

echo "Local setup is ready. Run 'mise run dev', then 'mise run smoke' in another terminal."
