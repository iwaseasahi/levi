import { describe, expect, it, vi } from "vitest";

import type { AuthRuntimeConfig } from "@/config/env";
import {
  buildAuthOptions,
  CHURCH_PASSWORD_RESET_EXPIRES_IN_SECONDS,
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
    expect(options.logger).toEqual({ disabled: true });
  });

  it("configures 24-hour password recovery callbacks", async () => {
    const sendResetPassword = vi.fn();
    const onPasswordReset = vi.fn();
    const options = buildAuthOptions(config("production"), {
      onPasswordReset,
      sendResetPassword,
    });

    expect(options.emailAndPassword.resetPasswordTokenExpiresIn).toBe(
      CHURCH_PASSWORD_RESET_EXPIRES_IN_SECONDS,
    );
    await options.emailAndPassword.sendResetPassword?.({
      user: { id: "user-id", name: "利用者", email: "user@example.com" },
      url: "https://levi.example/reset",
      token: "token",
    } as never);
    await options.emailAndPassword.onPasswordReset?.({
      user: { id: "user-id" },
    } as never);
    expect(sendResetPassword).toHaveBeenCalledWith({
      name: "利用者",
      resetUrl: "https://levi.example/reset",
      to: "user@example.com",
    });
    expect(onPasswordReset).toHaveBeenCalledWith("user-id");
  });

  it("uses database rate limits and server-owned actor fields", () => {
    const options = buildAuthOptions(config("test"));

    expect(options.rateLimit).toMatchObject({
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
    });
    expect(options.rateLimit.customRules).toEqual({
      "/sign-in/email": { max: 10, window: 60 },
      "/request-password-reset": { max: 5, window: 60 },
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
