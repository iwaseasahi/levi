import { describe, expect, it } from "vitest";

import type { AuthRuntimeConfig } from "@/config/env";
import {
  buildAuthOptions,
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from "./options";

const config = (nodeEnvironment: AuthRuntimeConfig["nodeEnvironment"]) => ({
  secret: "x".repeat(32),
  baseURL: "https://levi.example",
  trustedOrigins: ["https://levi.example"],
  nodeEnvironment,
});

describe("Better Auth options", () => {
  it("locks down sign-up, session, origins, cookies, and proxy trust", () => {
    const options = buildAuthOptions(config("production"));

    expect(options.emailAndPassword).toMatchObject({
      enabled: true,
      disableSignUp: true,
      autoSignIn: false,
    });
    expect(options.session).toMatchObject({
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      cookieCache: { enabled: false },
    });
    expect(options.advanced).toMatchObject({
      disableCSRFCheck: false,
      disableOriginCheck: false,
      crossSubDomainCookies: { enabled: false },
      trustedProxyHeaders: false,
      useSecureCookies: true,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      },
    });
    expect(options.trustedOrigins).toEqual(["https://levi.example"]);
  });

  it("uses database rate limits and server-owned actor fields", () => {
    const options = buildAuthOptions(config("test"));

    expect(options.rateLimit).toMatchObject({
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
    });
    expect(options.user.additionalFields).toMatchObject({
      actorState: { input: false, returned: false, defaultValue: "PENDING" },
      mustChangePassword: {
        input: false,
        returned: false,
        defaultValue: false,
      },
    });
    expect(options.advanced.useSecureCookies).toBe(false);
  });
});
