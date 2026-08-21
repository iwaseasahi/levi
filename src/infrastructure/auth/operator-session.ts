import { resolveOperatorAccess } from "@/application/auth/operator-access";
import { prisma } from "@/infrastructure/database/client";
import { auth } from "./server";

export function getOperatorAccess(headers: Headers) {
  return resolveOperatorAccess(headers, {
    async getSessionUserId(requestHeaders) {
      const session = await auth.api.getSession({ headers: requestHeaders });
      return session?.user.id ?? null;
    },
    async findActiveOperator(userId) {
      const operator = await prisma.platformOperator.findUnique({
        where: { userId },
        select: { user: { select: { actorState: true } } },
      });
      return operator?.user.actorState === "ACTIVE";
    },
  });
}
