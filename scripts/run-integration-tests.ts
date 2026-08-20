import { spawnSync } from "node:child_process";

const testEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://levi:levi@127.0.0.1:55433/levi_test?schema=public",
  NODE_ENV: "test",
  SHADOW_DATABASE_URL:
    process.env.TEST_SHADOW_DATABASE_URL ??
    process.env.SHADOW_DATABASE_URL ??
    "postgresql://levi:levi@127.0.0.1:55433/levi_shadow?schema=public",
};

function run(args: string[], env = process.env) {
  const result = spawnSync("pnpm", args, { env, stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.CI !== "true") {
  run(["db:up"]);
}
run(["exec", "prisma", "migrate", "deploy"], testEnvironment);
run(
  ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"],
  testEnvironment,
);
