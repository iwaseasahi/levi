import { resolveChurchAccess } from "@/application/auth/church-access";
import { prisma } from "@/infrastructure/database/client";
import { auth } from "./server";

export function getChurchAccess(headers: Headers) {
  return resolveChurchAccess(headers, {
    async getSessionUserId(requestHeaders) {
      const session = await auth.api.getSession({ headers: requestHeaders });
      return session?.user.id ?? null;
    },
    async findActiveChurchMembership(userId) {
      const membership = await prisma.churchMembership.findFirst({
        where: {
          userId,
          church: { status: "ACTIVE" },
          user: { actorState: "ACTIVE" },
        },
        select: {
          churchId: true,
          user: { select: { mustChangePassword: true } },
        },
      });

      return membership
        ? {
            churchId: membership.churchId,
            mustChangePassword: membership.user.mustChangePassword,
          }
        : null;
    },
  });
}

export async function getForcedPasswordChangeSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const access = await getChurchAccess(headers);
  if (access.status !== "authorized" || !access.mustChangePassword) return null;
  return { sessionId: session.session.id, userId: access.userId };
}
