import { hashPassword } from "better-auth/crypto";

import {
  createChurchUserInviter,
  type InviteChurchUserTransaction,
} from "@/application/admin/invite-church-user";
import { generateTemporaryPassword } from "@/application/admin/temporary-password";
import { getAuthRuntimeConfig } from "@/config/env";
import { canAdminUserManagePlatform } from "@/domain/admin/admin-user";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { runWithSerializableRetry } from "@/infrastructure/database/serializable-retry";
import { auth } from "./server";

function transactionAdapter(
  transaction: Prisma.TransactionClient,
): InviteChurchUserTransaction {
  return {
    async createChurchMembership(churchId, userId) {
      await transaction.churchMembership.create({
        data: { churchId, userId },
      });
    },
    async createCredential(input) {
      const user = await transaction.user.create({
        data: { email: input.email, name: input.name },
      });
      await transaction.account.create({
        data: {
          accountId: user.id,
          issuer: "local:credential",
          password: await hashPassword(input.password),
          providerId: "credential",
          userId: user.id,
        },
      });
      return { userId: user.id };
    },
    findActiveChurch(churchId) {
      return transaction.church.findFirst({
        select: { id: true, name: true },
        where: { id: churchId, status: "ACTIVE" },
      });
    },
    async findActiveOperator(userId) {
      const adminUser = await transaction.adminUser.findUnique({
        select: { status: true },
        where: { id: userId },
      });
      return adminUser ? canAdminUserManagePlatform(adminUser.status) : false;
    },
    async isPendingUser(userId) {
      const user = await transaction.user.findUnique({
        select: { actorState: true },
        where: { id: userId },
      });
      return user?.actorState === "PENDING";
    },
  };
}

export const inviteChurchUser = createChurchUserInviter({
  generatePassword: generateTemporaryPassword,
  async removeUnsentInvitation(userId) {
    await prisma.user.deleteMany({
      where: { actorState: "PENDING", id: userId },
    });
  },
  runTransaction(operation) {
    return runWithSerializableRetry(() =>
      prisma.$transaction(
        (transaction) => operation(transactionAdapter(transaction)),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  },
  async sendInvitation(email) {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${getAuthRuntimeConfig().baseURL}/reset-password`,
      },
    });
  },
});
