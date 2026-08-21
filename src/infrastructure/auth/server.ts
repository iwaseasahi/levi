import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";

import { getAuthRuntimeConfig, type AuthRuntimeConfig } from "@/config/env";
import { canActorStartSession } from "@/application/auth/session-eligibility";
import { prisma } from "@/infrastructure/database/client";
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
        platformOperator: { select: { userId: true } },
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
    ...buildAuthOptions(config),
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

export const auth = createAuth();
