#!/bin/sh
set -eu

exec /app/node_modules/.bin/tsx /app/scripts/import-ginmaku-bible.ts "$@"
