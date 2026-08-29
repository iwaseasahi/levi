import { afterEach, describe, expect, it } from "vitest";

import {
  getDatabaseUrl,
  parseAdminBasicAuthConfig,
  parseAuthRuntimeConfig,
  parseMailRuntimeConfig,
  parseNodeEnvironment,
} from "./env";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

describe("parseMailRuntimeConfig", () => {
  it("accepts unauthenticated Mailpit in local development", () => {
    expect(
      parseMailRuntimeConfig(
        {
          from: "levi-system@localhost.test",
          host: "127.0.0.1",
          password: undefined,
          port: "1125",
          secure: "false",
          user: undefined,
        },
        "development",
      ),
    ).toEqual({
      deliveryMode: "smtp",
      from: "levi-system@localhost.test",
      host: "127.0.0.1",
      port: 1125,
      secure: false,
    });
  });

  it("accepts non-delivering mail only in tests", () => {
    expect(
      parseMailRuntimeConfig(
        {
          deliveryMode: "discard",
          from: "levi-integration@example.invalid",
          host: undefined,
          password: undefined,
          port: undefined,
          secure: undefined,
          user: undefined,
        },
        "test",
      ),
    ).toEqual({
      deliveryMode: "discard",
      from: "levi-integration@example.invalid",
    });
  });

  it.each(["development", "production"] as const)(
    "rejects non-delivering mail in %s",
    (nodeEnvironment) => {
      expect(() =>
        parseMailRuntimeConfig(
          {
            deliveryMode: "discard",
            from: "levi-system@example.test",
            host: undefined,
            password: undefined,
            port: undefined,
            secure: undefined,
            user: undefined,
          },
          nodeEnvironment,
        ),
      ).toThrow("allowed only in tests");
    },
  );

  it("accepts authenticated Gmail submission in production", () => {
    expect(
      parseMailRuntimeConfig(
        {
          from: "levi.system.app@gmail.com",
          host: "smtp.gmail.com",
          password: "gmail-app-password",
          port: "587",
          secure: "false",
          user: "levi.system.app@gmail.com",
        },
        "production",
      ),
    ).toMatchObject({ host: "smtp.gmail.com", port: 587, secure: false });
  });

  it.each([
    [{ host: "mail.example.com" }, "authenticated Gmail"],
    [{ port: "465", secure: "true" }, "authenticated Gmail"],
    [{ password: undefined }, "set together"],
    [{ secure: "sometimes" }, "true or false"],
  ])("rejects unsafe mail configuration", (overrides, message) => {
    expect(() =>
      parseMailRuntimeConfig(
        {
          from: "levi.system.app@gmail.com",
          host: "smtp.gmail.com",
          password: "gmail-app-password",
          port: "587",
          secure: "false",
          user: "levi.system.app@gmail.com",
          ...overrides,
        },
        "production",
      ),
    ).toThrow(message);
  });
});

describe("parseAdminBasicAuthConfig", () => {
  const passwordHash = `${"a".repeat(32)}:${"b".repeat(128)}`;

  it("accepts a trimmed username and a Better Auth scrypt verifier", () => {
    expect(
      parseAdminBasicAuthConfig({
        passwordHash,
        username: " levi-admin ",
      }),
    ).toEqual({ passwordHash, username: "levi-admin" });
  });

  it.each([
    [{ username: "", passwordHash }, "ADMIN_BASIC_AUTH_USERNAME"],
    [{ username: "admin:name", passwordHash }, "ADMIN_BASIC_AUTH_USERNAME"],
    [{ username: "admin\nname", passwordHash }, "ADMIN_BASIC_AUTH_USERNAME"],
    [
      { username: "admin", passwordHash: "plaintext" },
      "ADMIN_BASIC_AUTH_PASSWORD_HASH",
    ],
  ])("rejects unsafe Basic authentication configuration", (values, message) => {
    expect(() => parseAdminBasicAuthConfig(values)).toThrow(message);
  });
});

describe("parseNodeEnvironment", () => {
  it("defaults to development", () => {
    expect(parseNodeEnvironment(undefined)).toBe("development");
  });

  it("accepts a supported environment", () => {
    expect(parseNodeEnvironment("production")).toBe("production");
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

describe("parseAuthRuntimeConfig", () => {
  const valid = {
    secret: "x".repeat(32),
    baseURL: "https://levi.example",
    trustedOrigins: "https://levi.example",
  };

  it("accepts exact HTTPS production origins", () => {
    expect(parseAuthRuntimeConfig(valid, "production")).toMatchObject({
      baseURL: "https://levi.example",
      trustedOrigins: ["https://levi.example"],
      nodeEnvironment: "production",
    });
  });

  it.each([
    [{ ...valid, secret: "too-short" }, "at least 32"],
    [{ ...valid, trustedOrigins: "https://*.example" }, "wildcard"],
    [{ ...valid, trustedOrigins: "https://other.example" }, "must include"],
    [
      {
        ...valid,
        baseURL: "http://levi.example",
        trustedOrigins: "http://levi.example",
      },
      "must use HTTPS",
    ],
    [
      { ...valid, baseURL: "https://levi.example/path" },
      "exact HTTP(S) origin",
    ],
  ])("rejects unsafe production configuration", (values, message) => {
    expect(() => parseAuthRuntimeConfig(values, "production")).toThrow(message);
  });
});
