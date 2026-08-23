import { prepareTestDatabase, runPnpm } from "./lib/test-runtime";
import { integrationTestEnvironment } from "../src/infrastructure/database/test-database-guard";

const testEnvironment = integrationTestEnvironment(process.env);

prepareTestDatabase(testEnvironment);
runPnpm(
  ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"],
  testEnvironment,
);
