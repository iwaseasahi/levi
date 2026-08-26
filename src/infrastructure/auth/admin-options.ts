import type { BetterAuthOptions } from "better-auth";
import { username } from "better-auth/plugins";

import type { AdminAuthRuntimeConfig } from "@/config/env";
import {
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from "./options";

export const ADMIN_AUTH_BASE_PATH = "/api/admin-auth";

export function buildAdminAuthOptions(
  config: AdminAuthRuntimeConfig,
  callbacks?: {
    onPasswordReset?(userId: string): Promise<void>;
    sendResetPassword?(input: {
      name: string;
      resetUrl: string;
      to: string;
    }): Promise<void>;
  },
) {
  return {
    appName: "Levi 管理画面",
    basePath: ADMIN_AUTH_BASE_PATH,
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        callbacks?.sendResetPassword?.({
          name: user.name,
          resetUrl: url,
          to: user.email,
        }),
      onPasswordReset: async ({ user }) =>
        callbacks?.onPasswordReset?.(user.id),
    },
    user: {
      modelName: "adminUser",
      additionalFields: {
        status: {
          type: ["BOOTSTRAP", "INVITED", "ACTIVE", "SUSPENDED"],
          required: true,
          defaultValue: "INVITED",
          input: false,
          returned: false,
        },
      },
    },
    account: { modelName: "adminAccount" },
    session: {
      modelName: "adminSession",
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      disableSessionRefresh: false,
      cookieCache: { enabled: false },
    },
    verification: { modelName: "adminVerification" },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "adminRateLimit",
      customRules: {
        "/sign-in/username": { window: 60, max: 10 },
        "/request-password-reset": { window: 60, max: 5 },
      },
    },
    plugins: [
      username({
        schema: { user: { fields: { username: "loginId" } } },
        displayUsername: false,
        immutableUsername: true,
        minUsernameLength: 3,
        maxUsernameLength: 100,
        usernameValidator: (value) => /^[a-zA-Z0-9._@-]+$/.test(value),
      }),
    ],
    advanced: {
      cookiePrefix: "levi-admin-auth",
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
