import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";

import {
  getAdminAuthRuntimeConfig,
  type AdminAuthRuntimeConfig,
} from "@/config/env";
import { prisma } from "@/infrastructure/database/client";
import { sendAdminPasswordLinkMail } from "./password-link-mail";
import { buildAdminAuthOptions } from "./admin-options";

interface AdminAuthDependencies {
  isSessionCreationAllowed(userId: string): Promise<boolean>;
}

const dependencies: AdminAuthDependencies = {
  async isSessionCreationAllowed(userId) {
    const user = await prisma.adminUser.findUnique({
      select: { status: true },
      where: { id: userId },
    });
    return user?.status === "ACTIVE";
  },
};

export async function activateInvitedAdminUserAfterPasswordReset(
  userId: string,
): Promise<void> {
  await prisma.adminUser.updateMany({
    data: { activatedAt: new Date(), status: "ACTIVE" },
    where: { id: userId, status: "INVITED" },
  });
}

export function createAdminAuth(
  config: AdminAuthRuntimeConfig = getAdminAuthRuntimeConfig(),
  authDependencies: AdminAuthDependencies = dependencies,
) {
  return betterAuth({
    ...buildAdminAuthOptions(config, {
      onPasswordReset: activateInvitedAdminUserAfterPasswordReset,
      sendResetPassword: sendAdminPasswordLinkMail,
    }),
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    databaseHooks: {
      session: {
        create: {
          before: (session) =>
            authDependencies.isSessionCreationAllowed(session.userId),
        },
      },
    },
  });
}

export const adminAuth = createAdminAuth();
