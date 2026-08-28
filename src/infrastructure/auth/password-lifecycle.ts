import { hashPassword } from "better-auth/crypto";

import { generateTemporaryPassword } from "@/application/admin/temporary-password";
import {
  createPasswordLifecycle,
  type PasswordLifecycleTransaction,
} from "@/application/auth/password-lifecycle";
import { Prisma } from "@/generated/prisma/client";
import { canAdminUserManagePlatform } from "@/domain/admin/admin-user";
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
    async findActiveOperator(userId) {
      const adminUser = await transaction.adminUser.findUnique({
        select: { status: true },
        where: { id: userId },
      });
      return adminUser ? canAdminUserManagePlatform(adminUser.status) : false;
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
    async findResetTarget(userId) {
      const membership = await transaction.churchMembership.findFirst({
        select: {
          church: {
            select: { id: true, name: true, status: true },
          },
          user: { select: { actorState: true, email: true, id: true } },
        },
        where: {
          church: { status: "ACTIVE" },
          user: { actorState: "ACTIVE" },
          userId,
        },
      });
      if (!membership) return null;
      return {
        churchId: membership.church.id,
        churchName: membership.church.name,
        email: membership.user.email,
        userId: membership.user.id,
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
      const adminUser = await prisma.adminUser.findUnique({
        select: { status: true },
        where: { id: userId },
      });
      return adminUser ? canAdminUserManagePlatform(adminUser.status) : false;
    },
    generateTemporaryPassword,
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
