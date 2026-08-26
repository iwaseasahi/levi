import { hashPassword } from "better-auth/crypto";

import {
  AdminUserInvitationDuplicateError,
  createAdminUserInviter,
  type InviteAdminUserStore,
} from "@/application/admin/invite-admin-user";
import { generateTemporaryPassword } from "@/application/admin/temporary-password";
import { getAdminAuthRuntimeConfig } from "@/config/env";
import { canAdminUserManagePlatform } from "@/domain/admin/admin-user";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { runWithSerializableRetry } from "@/infrastructure/database/serializable-retry";
import { adminAuth } from "./admin-server";

export interface AdminUserSummary {
  createdAt: Date;
  email: string;
  id: string;
  loginId: string;
  name: string;
  status: "ACTIVE" | "BOOTSTRAP" | "INVITED" | "SUSPENDED";
}

function store(transaction: Prisma.TransactionClient): InviteAdminUserStore {
  return {
    async canInvite(adminUserId) {
      const actor = await transaction.adminUser.findUnique({
        select: { status: true },
        where: { id: adminUserId },
      });
      return actor ? canAdminUserManagePlatform(actor.status) : false;
    },
    async create(input) {
      try {
        const adminUser = await transaction.adminUser.create({
          data: {
            email: input.email,
            invitedAt: new Date(),
            invitedByAdminUserId: input.invitedByAdminUserId,
            loginId: input.loginId,
            name: input.name,
            status: "INVITED",
          },
          select: { email: true, id: true, loginId: true, name: true },
        });
        await transaction.adminAccount.create({
          data: {
            accountId: adminUser.id,
            issuer: "local:credential",
            password: input.passwordHash,
            providerId: "credential",
            userId: adminUser.id,
          },
        });
        return adminUser;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
          throw new AdminUserInvitationDuplicateError();
        throw error;
      }
    },
  };
}

export function createAdminUserInvitationService(
  sendInvitation: (email: string) => Promise<void>,
) {
  return createAdminUserInviter({
    generatePassword: generateTemporaryPassword,
    hashPassword,
    async removeUnsentInvitation(adminUserId) {
      await prisma.adminUser.deleteMany({
        where: { id: adminUserId, status: "INVITED" },
      });
    },
    sendInvitation,
    runTransaction(operation) {
      return runWithSerializableRetry(() =>
        prisma.$transaction((transaction) => operation(store(transaction)), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }),
      );
    },
  });
}

export const inviteAdminUser = createAdminUserInvitationService(
  async (email) => {
    await adminAuth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${getAdminAuthRuntimeConfig().baseURL}/admin/reset-password`,
      },
    });
  },
);

export function listAdminUsers(): Promise<AdminUserSummary[]> {
  return prisma.adminUser.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      createdAt: true,
      id: true,
      loginId: true,
      email: true,
      name: true,
      status: true,
    },
    where: { status: { not: "BOOTSTRAP" } },
  });
}
