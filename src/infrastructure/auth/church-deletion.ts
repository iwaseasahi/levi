import {
  createChurchDeleter,
  type DeleteChurchStore,
} from "@/application/admin/delete-church";
import { canAdminUserManagePlatform } from "@/domain/admin/admin-user";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/database/client";
import { runWithSerializableRetry } from "@/infrastructure/database/serializable-retry";

function store(transaction: Prisma.TransactionClient): DeleteChurchStore {
  return {
    async canDelete(adminUserId) {
      const actor = await transaction.adminUser.findUnique({
        select: { status: true },
        where: { id: adminUserId },
      });
      return actor ? canAdminUserManagePlatform(actor.status) : false;
    },
    async deleteChurch(churchId) {
      await transaction.church.delete({ where: { id: churchId } });
    },
    async deleteUserVerifications(userIds) {
      await transaction.verification.deleteMany({
        where: { value: { in: userIds } },
      });
    },
    async deleteUsers(userIds) {
      await transaction.user.deleteMany({ where: { id: { in: userIds } } });
    },
    async findTarget(churchId) {
      const target = await transaction.church.findUnique({
        select: {
          memberships: { select: { userId: true } },
          name: true,
        },
        where: { id: churchId },
      });
      return target
        ? {
            name: target.name,
            userIds: target.memberships.map(({ userId }) => userId),
          }
        : null;
    },
  };
}

export const deleteChurch = createChurchDeleter({
  runTransaction(operation) {
    return runWithSerializableRetry(() =>
      prisma.$transaction((transaction) => operation(store(transaction)), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  },
});
