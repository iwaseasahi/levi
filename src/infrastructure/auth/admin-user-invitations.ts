import { hashPassword } from "better-auth/crypto";

import {
  AdminUserInvitationDuplicateError,
  createAdminUserInviter,
  type InviteAdminUserStore,
} from "@/application/admin/invite-admin-user";
import { generateTemporaryPassword } from "@/application/admin/temporary-password";
import { canAdminUserManagePlatform } from "@/domain/admin/admin-user";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { runWithSerializableRetry } from "@/infrastructure/database/serializable-retry";

export interface AdminUserSummary {
  createdAt: Date;
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
        return await transaction.adminUser.create({
          data: {
            invitedAt: new Date(),
            invitedByAdminUserId: input.invitedByAdminUserId,
            loginId: input.loginId,
            mustChangePassword: true,
            name: input.name,
            passwordHash: input.passwordHash,
            status: "INVITED",
          },
          select: { id: true, loginId: true, name: true },
        });
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

export const inviteAdminUser = createAdminUserInviter({
  generatePassword: generateTemporaryPassword,
  hashPassword,
  runTransaction(operation) {
    return runWithSerializableRetry(() =>
      prisma.$transaction((transaction) => operation(store(transaction)), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  },
});

export function listAdminUsers(): Promise<AdminUserSummary[]> {
  return prisma.adminUser.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      createdAt: true,
      id: true,
      loginId: true,
      name: true,
      status: true,
    },
  });
}
