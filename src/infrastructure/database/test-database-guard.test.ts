import { describe, expect, it } from "vitest";

import {
  assertDedicatedTestDatabaseTarget,
  assertDedicatedTestEnvironment,
  e2eTestDatabaseEnvironment,
  integrationTestEnvironment,
} from "./test-database-guard";

const dedicated =
  "postgresql://levi:synthetic@127.0.0.1:55433/levi_test?schema=public";

describe("dedicated test database policy", () => {
  it("accepts only the named loopback test database", () => {
    expect(() => assertDedicatedTestDatabaseTarget(dedicated)).not.toThrow();
  });

  it.each([
    undefined,
    "not-a-url",
    "mysql://levi:synthetic@127.0.0.1/levi_test",
    "postgresql://levi:synthetic@db.example.test/levi_test",
    "postgresql://levi:synthetic@127.0.0.1/levi",
    "postgresql://levi:synthetic@127.0.0.1/production",
  ])("rejects an unsafe target", (value) => {
    expect(() => assertDedicatedTestDatabaseTarget(value)).toThrow();
  });

  it("requires the complete test environment before setup", () => {
    expect(() =>
      assertDedicatedTestEnvironment({
        DATABASE_URL: dedicated,
        NODE_ENV: "test",
        SHADOW_DATABASE_URL:
          "postgresql://levi:synthetic@localhost:55433/levi_shadow",
      }),
    ).not.toThrow();
    expect(() =>
      assertDedicatedTestEnvironment({
        DATABASE_URL: dedicated,
        NODE_ENV: "development",
        SHADOW_DATABASE_URL:
          "postgresql://levi:synthetic@localhost:55433/levi_shadow",
      }),
    ).toThrow("NODE_ENV=test");
  });
});

describe("test environment resolution", () => {
  it("ignores an ambient development DATABASE_URL for integration", () => {
    const result = integrationTestEnvironment({
      DATABASE_URL: "postgresql://levi:levi@127.0.0.1:55432/levi",
      TEST_DATABASE_URL: dedicated,
    });
    expect(result.DATABASE_URL).toBe(dedicated);
  });

  it("ignores an ambient development DATABASE_URL for E2E", () => {
    const result = e2eTestDatabaseEnvironment({
      DATABASE_URL: "postgresql://levi:levi@127.0.0.1:55432/levi",
      E2E_DATABASE_URL: dedicated,
    });
    expect(result.DATABASE_URL).toBe(dedicated);
  });

  it("never falls back to the ambient development DATABASE_URL", () => {
    const ambient = {
      DATABASE_URL: "postgresql://levi:levi@127.0.0.1:55432/levi",
    };
    expect(integrationTestEnvironment(ambient).DATABASE_URL).toContain(
      "/levi_test",
    );
    expect(e2eTestDatabaseEnvironment(ambient).DATABASE_URL).toContain(
      "/levi_test",
    );
  });
});
