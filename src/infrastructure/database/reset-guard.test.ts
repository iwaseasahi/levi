import { describe, expect, it } from "vitest";

import { assertLocalResetTarget } from "./reset-guard";

describe("assertLocalResetTarget", () => {
  it.each([
    "postgresql://levi:synthetic@127.0.0.1:55432/levi?schema=public",
    "postgres://levi:synthetic@localhost:55433/levi_test?schema=public",
  ])("allows a named local disposable database", (databaseUrl) => {
    expect(() =>
      assertLocalResetTarget(databaseUrl, "development"),
    ).not.toThrow();
  });

  it.each([
    [undefined, "development"],
    ["not-a-url", "development"],
    ["mysql://levi:synthetic@127.0.0.1/levi", "development"],
    ["postgresql://levi:synthetic@db.example.invalid/levi", "development"],
    ["postgresql://levi:synthetic@127.0.0.1/production", "development"],
    ["postgresql://levi:synthetic@127.0.0.1/levi", "production"],
  ])(
    "rejects a missing, invalid, remote, unknown, or production target",
    (databaseUrl, nodeEnvironment) => {
      expect(() =>
        assertLocalResetTarget(databaseUrl, nodeEnvironment),
      ).toThrow();
    },
  );
});
