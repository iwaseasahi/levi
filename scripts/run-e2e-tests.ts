import { spawnSync } from "node:child_process";
import { hashPassword } from "better-auth/crypto";

const e2eAdminPassword = "e".repeat(16);

const e2eEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  BETTER_AUTH_BASE_URL:
    process.env.E2E_BETTER_AUTH_BASE_URL ?? "http://127.0.0.1:3100",
  BETTER_AUTH_TRUSTED_ORIGINS:
    process.env.E2E_BETTER_AUTH_TRUSTED_ORIGINS ?? "http://127.0.0.1:3100",
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ??
    "synthetic-e2e-secret-not-for-production-000000000000",
  DATABASE_URL:
    process.env.E2E_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://levi:levi@127.0.0.1:55433/levi_test?schema=public",
  SHADOW_DATABASE_URL:
    process.env.E2E_SHADOW_DATABASE_URL ??
    process.env.SHADOW_DATABASE_URL ??
    "postgresql://levi:levi@127.0.0.1:55433/levi_shadow?schema=public",
  ADMIN_BASIC_AUTH_USERNAME:
    process.env.ADMIN_BASIC_AUTH_USERNAME ?? "test-e2e-admin",
  ADMIN_BASIC_AUTH_PASSWORD_HASH:
    process.env.ADMIN_BASIC_AUTH_PASSWORD_HASH ??
    (await hashPassword(e2eAdminPassword)),
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
run(["exec", "prisma", "generate"], e2eEnvironment);
run(["exec", "prisma", "migrate", "deploy"], e2eEnvironment);
run(["exec", "playwright", "test"], e2eEnvironment);
