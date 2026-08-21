import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";

import { getAuthRuntimeConfig, type AuthRuntimeConfig } from "@/config/env";
import { prisma } from "@/infrastructure/database/client";
import { buildAuthOptions } from "./options";

export function createAuth(config: AuthRuntimeConfig = getAuthRuntimeConfig()) {
  return betterAuth({
    ...buildAuthOptions(config),
    database: prismaAdapter(prisma, { provider: "postgresql" }),
  });
}

export const auth = createAuth();
