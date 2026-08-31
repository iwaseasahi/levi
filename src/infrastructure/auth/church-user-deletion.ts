import {
  createChurchUserDeleter,
  type DeleteChurchUserStore,
} from "@/application/admin/delete-church-user";
import { canAdminUserManagePlatform } from "@/domain/admin/admin-user";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { runWithSerializableRetry } from "@/infrastructure/database/serializable-retry";

export function createChurchUserDeletionStore(
  transaction: Prisma.TransactionClient,
): DeleteChurchUserStore {
  return {
    async canDelete(adminUserId) {
      const actor = await transaction.adminUser.findUnique({
        select: { status: true },
        where: { id: adminUserId },
      });
      return actor ? canAdminUserManagePlatform(actor.status) : false;
    },
    findTarget(churchId, userId) {
      return transaction.user.findFirst({
        select: { email: true },
        where: { id: userId, churchMembership: { churchId } },
      });
    },
    async deleteVerifications(userId) {
      await transaction.verification.deleteMany({
        where: { value: userId },
      });
    },
    async deleteUser(userId) {
      // Account, Session and ChurchMembership are deleted by their User FKs.
      await transaction.user.delete({ where: { id: userId } });
    },
  };
}

export const deleteChurchUser = createChurchUserDeleter({
  runTransaction(operation) {
    return runWithSerializableRetry(() =>
      prisma.$transaction(
        (transaction) => operation(createChurchUserDeletionStore(transaction)),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  },
});
