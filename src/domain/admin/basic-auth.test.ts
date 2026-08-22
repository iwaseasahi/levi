import { hashPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";

import {
  parseBasicAuthorization,
  verifyAdminBasicAuthorization,
} from "./basic-auth";

function authorization(value: string) {
  return `Basic ${Buffer.from(value, "utf8").toString("base64")}`;
}

describe("parseBasicAuthorization", () => {
  it("splits on the first colon so passwords may contain colons", () => {
    expect(parseBasicAuthorization(authorization("admin:one:two"))).toEqual({
      password: "one:two",
      username: "admin",
    });
  });

  it.each([
    null,
    "Bearer abc",
    "Basic !!!=",
    `Basic ${Buffer.from(":password").toString("base64")}`,
    `Basic ${"A".repeat(1024)}`,
  ])("rejects malformed credentials", (value) => {
    expect(parseBasicAuthorization(value)).toBeNull();
  });

  it("rejects invalid UTF-8", () => {
    expect(
      parseBasicAuthorization(
        `Basic ${Buffer.from([0xff]).toString("base64")}`,
      ),
    ).toBeNull();
  });
});

describe("verifyAdminBasicAuthorization", () => {
  it("accepts only the configured username and password", async () => {
    const config = {
      passwordHash: await hashPassword("a-secure-password"),
      username: "levi-admin",
    };

    await expect(
      verifyAdminBasicAuthorization(
        authorization("levi-admin:a-secure-password"),
        config,
      ),
    ).resolves.toBe(true);
    await expect(
      verifyAdminBasicAuthorization(
        authorization("levi-admin:incorrect-password"),
        config,
      ),
    ).resolves.toBe(false);
    await expect(
      verifyAdminBasicAuthorization(
        authorization("other:a-secure-password"),
        config,
      ),
    ).resolves.toBe(false);
  });
});
