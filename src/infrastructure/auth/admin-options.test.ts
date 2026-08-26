import { describe, expect, it } from "vitest";

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
  it("uses native email sign-in without a username plugin", () => {
    const options = buildAdminAuthOptions(config);

    expect(options.emailAndPassword).toMatchObject({
      disableSignUp: true,
      enabled: true,
      resetPasswordTokenExpiresIn: ADMIN_PASSWORD_RESET_EXPIRES_IN_SECONDS,
    });
    expect(ADMIN_PASSWORD_RESET_EXPIRES_IN_SECONDS).toBe(24 * 60 * 60);
    expect(options.rateLimit.customRules).toMatchObject({
      "/sign-in/email": { max: 10, window: 60 },
    });
    expect(options.rateLimit.customRules).not.toHaveProperty(
      "/sign-in/username",
    );
    expect(options).not.toHaveProperty("plugins");
  });
});
