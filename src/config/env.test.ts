import { afterEach, describe, expect, it } from "vitest";

import { getDatabaseUrl, parseNodeEnvironment } from "./env";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

describe("parseNodeEnvironment", () => {
  it("defaults to development", () => {
    expect(parseNodeEnvironment(undefined)).toBe("development");
  });

  it("accepts a supported environment", () => {
    expect(parseNodeEnvironment("production")).toBe("development");
  });

  it("rejects an unsupported environment", () => {
    expect(() => parseNodeEnvironment("preview")).toThrow(
      "Invalid NODE_ENV: preview",
    );
  });
});

describe("getDatabaseUrl", () => {
  it("returns the configured database URL", () => {
    process.env.DATABASE_URL = "postgresql://example.invalid/levi";

    expect(getDatabaseUrl()).toBe("postgresql://example.invalid/levi");
  });

  it("fails closed when the URL is absent", () => {
    delete process.env.DATABASE_URL;

    expect(() => getDatabaseUrl()).toThrow(
      "DATABASE_URL is required for database access",
    );
  });
});
