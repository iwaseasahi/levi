import { prepareTestDatabase, runPnpm } from "./lib/test-runtime";
import {
  assertDedicatedIntegrationTestEnvironment,
  integrationTestEnvironment,
} from "../src/infrastructure/database/test-database-guard";

const testEnvironment = integrationTestEnvironment(process.env);
assertDedicatedIntegrationTestEnvironment(testEnvironment);

prepareTestDatabase(testEnvironment);
runPnpm(
  ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"],
  testEnvironment,
);
