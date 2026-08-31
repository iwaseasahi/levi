import { describe, expect, it, vi } from "vitest";

import type { AdminAuthRuntimeConfig } from "@/config/env";
import {
  ADMIN_PASSWORD_RESET_EXPIRES_IN_SECONDS,
  buildAdminAuthOptions,
} from "./admin-options";

const config: AdminAuthRuntimeConfig = {
  baseURL: "https://levi.example",
  nodeEnvironment: "test",
  secret: "x".repeat(32),
  trustedOrigins: ["https://levi.example"],
};

describe("administrator Better Auth options", () => {
  it("forwards the framework-resolved user identifier for email purpose selection", async () => {
    const sendResetPassword = vi.fn();
    const options = buildAdminAuthOptions(config, { sendResetPassword });
    await options.emailAndPassword.sendResetPassword({
      user: {
        id: "admin-id",
        name: "管理者",
        email: "admin@example.invalid",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      url: "https://levi.example/admin/reset",
      token: "synthetic-token",
    });
    expect(sendResetPassword).toHaveBeenCalledExactlyOnceWith({
      userId: "admin-id",
      name: "管理者",
      to: "admin@example.invalid",
      resetUrl: "https://levi.example/admin/reset",
    });
  });
  it("uses native email sign-in without a username plugin", () => {
    const options = buildAdminAuthOptions(config);

    expect(options.emailAndPassword).toMatchObject({
      disableSignUp: true,
      enabled: true,
      resetPasswordTokenExpiresIn: ADMIN_PASSWORD_RESET_EXPIRES_IN_SECONDS,
    });
    expect(ADMIN_PASSWORD_RESET_EXPIRES_IN_SECONDS).toBe(3 * 24 * 60 * 60);
    expect(options.rateLimit.customRules).toMatchObject({
      "/sign-in/email": { max: 10, window: 60 },
    });
    expect(options.rateLimit.customRules).not.toHaveProperty(
      "/sign-in/username",
    );
    expect(options).not.toHaveProperty("plugins");
  });
});
