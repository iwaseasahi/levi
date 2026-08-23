import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";

import {
  createChurchProvisioner,
  type ProvisionChurchTransaction,
} from "@/application/admin/provision-church";
import { generateTemporaryPassword } from "@/application/admin/temporary-password";
import { getAuthRuntimeConfig } from "@/config/env";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { runWithSerializableRetry } from "@/infrastructure/database/serializable-retry";
import { buildAuthOptions } from "./options";

function credentialWriter(transaction: Prisma.TransactionClient) {
  const options = buildAuthOptions(getAuthRuntimeConfig());
  return betterAuth({
    ...options,
    database: prismaAdapter(transaction, {
      provider: "postgresql",
      transaction: false,
    }),
    emailAndPassword: {
      ...options.emailAndPassword,
      autoSignIn: false,
      disableSignUp: false,
    },
  });
}

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
      const result = await credentialWriter(transaction).api.signUpEmail({
        body: input,
      });
      return { userId: result.user.id };
    },
    async findActiveOperator(userId) {
      const operator = await transaction.platformOperator.findUnique({
        select: { user: { select: { actorState: true } } },
        where: { userId },
      });
      return operator?.user.actorState === "ACTIVE";
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
