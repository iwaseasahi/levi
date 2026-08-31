import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";

import { getAuthRuntimeConfig, type AuthRuntimeConfig } from "@/config/env";
import { canActorStartSession } from "@/application/auth/session-eligibility";
import { prisma } from "@/infrastructure/database/client";
import { sendChurchPasswordLinkMail } from "./password-link-mail";
import { buildAuthOptions } from "./options";

interface AuthDependencies {
  isSessionCreationAllowed(userId: string): Promise<boolean>;
}

const authDependencies: AuthDependencies = {
  async isSessionCreationAllowed(userId) {
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        actorState: true,
        churchMembership: {
          select: { church: { select: { status: true } } },
        },
      },
    });
    return canActorStartSession(actor);
  },
};

export function createAuth(
  config: AuthRuntimeConfig = getAuthRuntimeConfig(),
  dependencies: AuthDependencies = authDependencies,
) {
  return betterAuth({
    ...buildAuthOptions(config, {
      onPasswordReset: activateInvitedChurchUserAfterPasswordReset,
      sendResetPassword: sendChurchPasswordLinkMail,
    }),
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    databaseHooks: {
      session: {
        create: {
          before: (session) =>
            dependencies.isSessionCreationAllowed(session.userId),
        },
      },
    },
  });
}

export async function activateInvitedChurchUserAfterPasswordReset(
  userId: string,
): Promise<void> {
  await prisma.user.updateMany({
    data: { actorState: "ACTIVE", mustChangePassword: false },
    where: { actorState: "PENDING", id: userId },
  });
}

export const auth = createAuth();
