import { hashPassword } from "better-auth/crypto";

import {
  createPasswordLifecycle,
  type PasswordLifecycleTransaction,
} from "@/application/auth/password-lifecycle";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { runWithSerializableRetry } from "@/infrastructure/database/serializable-retry";

function transactionAdapter(
  transaction: Prisma.TransactionClient,
): PasswordLifecycleTransaction {
  return {
    async clearForcedPasswordChange(userId) {
      await transaction.user.update({
        data: { mustChangePassword: false },
        where: { id: userId },
      });
    },
    async findForcedChangeAccount({ sessionId, userId }) {
      const session = await transaction.session.findFirst({
        where: { expiresAt: { gt: new Date() }, id: sessionId, userId },
      });
      if (!session) return null;
      const user = await transaction.user.findFirst({
        select: {
          accounts: {
            select: { id: true, password: true },
            where: { providerId: "credential" },
          },
        },
        where: {
          actorState: "ACTIVE",
          churchMembership: { church: { status: "ACTIVE" } },
          id: userId,
          mustChangePassword: true,
        },
      });
      const account = user?.accounts[0];
      return account?.password ? { accountId: account.id } : null;
    },
    async revokeOtherSessions(userId, sessionId) {
      await transaction.session.deleteMany({
        where: { id: { not: sessionId }, userId },
      });
    },
    async updateCredentialPassword(accountId, hash) {
      await transaction.account.update({
        data: { password: hash },
        where: { id: accountId },
      });
    },
  };
}

export const { completeForcedPasswordChange } = createPasswordLifecycle({
  hashPassword,
  runTransaction(operation) {
    return runWithSerializableRetry(() =>
      prisma.$transaction(
        (transaction) => operation(transactionAdapter(transaction)),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  },
});
