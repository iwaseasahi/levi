import { hashPassword } from "better-auth/crypto";

import { generateTemporaryPassword } from "@/application/admin/temporary-password";
import {
  createPasswordLifecycle,
  type PasswordLifecycleTransaction,
} from "@/application/auth/password-lifecycle";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/client";

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
    async findActiveOperator(userId) {
      const operator = await transaction.platformOperator.findUnique({
        select: { user: { select: { actorState: true } } },
        where: { userId },
      });
      return operator?.user.actorState === "ACTIVE";
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
    async findResetTarget(churchId) {
      const church = await transaction.church.findFirst({
        select: {
          id: true,
          membership: {
            select: {
              user: {
                select: { actorState: true, email: true, id: true },
              },
            },
          },
          name: true,
        },
        where: { id: churchId, status: "ACTIVE" },
      });
      const user = church?.membership?.user;
      if (!church || !user || user.actorState !== "ACTIVE") return null;
      return {
        churchId: church.id,
        churchName: church.name,
        email: user.email,
        userId: user.id,
      };
    },
    async markForcedPasswordChange(userId) {
      await transaction.user.update({
        data: { mustChangePassword: true },
        where: { id: userId },
      });
    },
    async replaceCredentialPassword(userId, hash) {
      const updated = await transaction.account.updateMany({
        data: { password: hash },
        where: { providerId: "credential", userId },
      });
      return updated.count === 1;
    },
    async revokeAllSessions(userId) {
      await transaction.session.deleteMany({ where: { userId } });
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

export const { completeForcedPasswordChange, resetChurchPassword } =
  createPasswordLifecycle({
    async findActiveOperator(userId) {
      const operator = await prisma.platformOperator.findUnique({
        select: { user: { select: { actorState: true } } },
        where: { userId },
      });
      return operator?.user.actorState === "ACTIVE";
    },
    generateTemporaryPassword,
    hashPassword,
    runTransaction(operation) {
      return prisma.$transaction(
        (transaction) => operation(transactionAdapter(transaction)),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    },
  });
