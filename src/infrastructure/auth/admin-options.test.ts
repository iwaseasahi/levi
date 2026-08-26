import { describe, expect, it } from "vitest";

import type { AdminAuthRuntimeConfig } from "@/config/env";
import { buildAdminAuthOptions } from "./admin-options";

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
    });
    expect(options.rateLimit.customRules).toMatchObject({
      "/sign-in/email": { max: 10, window: 60 },
    });
    expect(options.rateLimit.customRules).not.toHaveProperty(
      "/sign-in/username",
    );
    expect(options).not.toHaveProperty("plugins");
  });
});
