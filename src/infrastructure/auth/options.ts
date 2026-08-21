import type { BetterAuthOptions } from "better-auth";

import type { AuthRuntimeConfig } from "@/config/env";

export const SESSION_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

export function buildAuthOptions(config: AuthRuntimeConfig) {
  return {
    appName: "Levi",
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      additionalFields: {
        actorState: {
          type: ["PENDING", "ACTIVE"],
          required: true,
          defaultValue: "PENDING",
          input: false,
          returned: false,
        },
        mustChangePassword: {
          type: "boolean",
          required: true,
          defaultValue: false,
          input: false,
          returned: false,
        },
      },
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      disableSessionRefresh: false,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: config.nodeEnvironment === "production",
      disableCSRFCheck: false,
      disableOriginCheck: false,
      crossSubDomainCookies: { enabled: false },
      trustedProxyHeaders: false,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.nodeEnvironment === "production",
        path: "/",
      },
    },
    telemetry: { enabled: false },
    logger: { disabled: true },
  } satisfies BetterAuthOptions;
}
