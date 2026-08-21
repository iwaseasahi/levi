import { spawnSync } from "node:child_process";

import { assertLocalResetTarget } from "../src/infrastructure/database/reset-guard.js";

const databaseUrl = process.env.DATABASE_URL;

assertLocalResetTarget(databaseUrl, process.env.NODE_ENV);

const result = spawnSync(
  "pnpm",
  ["exec", "prisma", "migrate", "reset", "--force"],
  { stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
