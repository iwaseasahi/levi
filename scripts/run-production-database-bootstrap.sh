#!/bin/sh
# Dormant companion entrypoint for a future purpose-built Bible importer image.
# It is intentionally absent from the current production migration image.
set -eu

exec /app/node_modules/.bin/tsx /app/prisma/seed.ts
