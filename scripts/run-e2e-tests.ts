import { hashPassword } from "better-auth/crypto";

import {
  prepareTestDatabase,
  runPnpm,
  TestCommandError,
} from "./lib/test-runtime";
import { e2eTestDatabaseEnvironment } from "../src/infrastructure/database/test-database-guard";

const e2eAdminPassword = "e".repeat(16);

const e2eEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  ...e2eTestDatabaseEnvironment(process.env),
  BETTER_AUTH_BASE_URL:
    process.env.E2E_BETTER_AUTH_BASE_URL ?? "http://127.0.0.1:3100",
  BETTER_AUTH_TRUSTED_ORIGINS:
    process.env.E2E_BETTER_AUTH_TRUSTED_ORIGINS ?? "http://127.0.0.1:3100",
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ??
    "synthetic-e2e-secret-not-for-production-000000000000",
  ADMIN_BETTER_AUTH_SECRET:
    process.env.ADMIN_BETTER_AUTH_SECRET ??
    "synthetic-e2e-admin-secret-not-for-production-00000000",
  ADMIN_BASIC_AUTH_USERNAME:
    process.env.ADMIN_BASIC_AUTH_USERNAME ?? "test-e2e-admin",
  ADMIN_BASIC_AUTH_PASSWORD_HASH:
    process.env.ADMIN_BASIC_AUTH_PASSWORD_HASH ??
    (await hashPassword(e2eAdminPassword)),
  MAIL_FROM: "levi-e2e@example.invalid",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1126",
  SMTP_SECURE: "false",
  SMTP_USER: undefined,
  SMTP_PASSWORD: undefined,
  E2E_MAILPIT_API_URL: "http://127.0.0.1:8027",
  NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? ".next-e2e",
};

let failure: unknown;

try {
  prepareTestDatabase(e2eEnvironment, {
    exitOnFailure: false,
    localSetupScript: "db:up:e2e",
  });
  runPnpm(["exec", "playwright", "test"], e2eEnvironment, {
    exitOnFailure: false,
  });
} catch (error) {
  failure = error;
} finally {
  if (process.env.CI !== "true") {
    try {
      runPnpm(["db:clean:e2e"], process.env, { exitOnFailure: false });
    } catch (cleanupError) {
      failure ??= cleanupError;
    }
  }
}

if (failure instanceof TestCommandError) {
  process.exitCode = failure.exitCode;
} else if (failure) {
  throw failure;
}
