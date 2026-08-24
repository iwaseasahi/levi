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

function transactionAdapter(
  transaction: Prisma.TransactionClient,
): ProvisionChurchTransaction {
  return {
    async activateUser(userId) {
      await transaction.user.update({
        data: { actorState: "ACTIVE", mustChangePassword: true },
        where: { id: userId },
      });
    },
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
  runTransaction(operation) {
    return runWithSerializableRetry(() =>
      prisma.$transaction(
        (transaction) => operation(transactionAdapter(transaction)),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  },
});
