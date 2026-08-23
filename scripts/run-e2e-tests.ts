import { hashPassword } from "better-auth/crypto";

import { prepareTestDatabase, runPnpm } from "./lib/test-runtime";
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
  ADMIN_BASIC_AUTH_USERNAME:
    process.env.ADMIN_BASIC_AUTH_USERNAME ?? "test-e2e-admin",
  ADMIN_BASIC_AUTH_PASSWORD_HASH:
    process.env.ADMIN_BASIC_AUTH_PASSWORD_HASH ??
    (await hashPassword(e2eAdminPassword)),
};

prepareTestDatabase(e2eEnvironment);
runPnpm(["exec", "playwright", "test"], e2eEnvironment);
