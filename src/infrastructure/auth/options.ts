import type { BetterAuthOptions } from "better-auth";

import type { AuthRuntimeConfig } from "@/config/env";
import { PASSWORD_LINK_EXPIRES_IN_SECONDS } from "@/config/password-link";

export const SESSION_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;
export const CHURCH_PASSWORD_RESET_EXPIRES_IN_SECONDS =
  PASSWORD_LINK_EXPIRES_IN_SECONDS;

export function buildAuthOptions(
  config: AuthRuntimeConfig,
  callbacks?: {
    onPasswordReset?(userId: string): Promise<void>;
    sendResetPassword?(input: {
      userId: string;
      name: string;
      resetUrl: string;
      to: string;
    }): Promise<void>;
  },
) {
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
      resetPasswordTokenExpiresIn: CHURCH_PASSWORD_RESET_EXPIRES_IN_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        callbacks?.sendResetPassword?.({
          userId: user.id,
          name: user.name,
          resetUrl: url,
          to: user.email,
        }),
      onPasswordReset: async ({ user }) =>
        callbacks?.onPasswordReset?.(user.id),
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
        "/sign-in/email": { window: 60, max: 10 },
        "/request-password-reset": { window: 60, max: 5 },
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
