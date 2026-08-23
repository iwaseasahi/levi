import { prepareTestDatabase, runPnpm } from "./lib/test-runtime";

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

prepareTestDatabase(testEnvironment);
runPnpm(
  ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"],
  testEnvironment,
);
