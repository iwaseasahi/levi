import { hashPassword } from "better-auth/crypto";

import {
  createChurchProvisioner,
  type ProvisionChurchTransaction,
} from "@/application/admin/provision-church";
import { generateTemporaryPassword } from "@/application/admin/temporary-password";
import { Prisma } from "@/generated/prisma/client";
import { canAdminUserManagePlatform } from "@/domain/admin/admin-user";
import { prisma } from "@/infrastructure/database/client";
import { runWithSerializableRetry } from "@/infrastructure/database/serializable-retry";
import { getAuthRuntimeConfig } from "@/config/env";
import { auth } from "./server";

function transactionAdapter(
  transaction: Prisma.TransactionClient,
): ProvisionChurchTransaction {
  return {
    createChurch(name) {
      return transaction.church.create({
        data: { name },
        select: { id: true, name: true },
      });
    },
    async createChurchMembership(churchId, userId) {
      await transaction.churchMembership.create({
        data: { churchId, userId },
      });
    },
    async createCredential(input) {
      const password = await hashPassword(input.password);
      const user = await transaction.user.create({
        data: {
          email: input.email,
          name: input.name,
        },
      });
      await transaction.account.create({
        data: {
          accountId: user.id,
          issuer: "local:credential",
          password,
          providerId: "credential",
          userId: user.id,
        },
      });
      return { userId: user.id };
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

export const provisionChurch = createChurchProvisioner({
  generatePassword: generateTemporaryPassword,
  async removeUnsentProvision({ churchId, userId }) {
    await prisma.$transaction(async (transaction) => {
      await transaction.church.deleteMany({ where: { id: churchId } });
      await transaction.user.deleteMany({
        where: { actorState: "PENDING", id: userId },
      });
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
