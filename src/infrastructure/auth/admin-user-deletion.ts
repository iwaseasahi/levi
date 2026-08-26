import {
  createAdminUserDeleter,
  type DeleteAdminUserStore,
} from "@/application/admin/delete-admin-user";
import { canAdminUserManagePlatform } from "@/domain/admin/admin-user";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { runWithSerializableRetry } from "@/infrastructure/database/serializable-retry";

function store(transaction: Prisma.TransactionClient): DeleteAdminUserStore {
  return {
    async canDelete(adminUserId) {
      const actor = await transaction.adminUser.findUnique({
        select: { status: true },
        where: { id: adminUserId },
      });
      return actor ? canAdminUserManagePlatform(actor.status) : false;
    },
    countActive() {
      return transaction.adminUser.count({ where: { status: "ACTIVE" } });
    },
    async delete(adminUserId) {
      await transaction.adminUser.delete({ where: { id: adminUserId } });
    },
    async findStatus(adminUserId) {
      const target = await transaction.adminUser.findUnique({
        select: { status: true },
        where: { id: adminUserId },
      });
      return target?.status ?? null;
    },
    async removeInviterReferences(adminUserId) {
      await transaction.adminUser.updateMany({
        data: { invitedByAdminUserId: null },
        where: { invitedByAdminUserId: adminUserId },
      });
    },
  };
}

export const deleteAdminUser = createAdminUserDeleter({
  runTransaction(operation) {
    return runWithSerializableRetry(() =>
      prisma.$transaction((transaction) => operation(store(transaction)), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  },
});
