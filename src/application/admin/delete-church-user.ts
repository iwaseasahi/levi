export class ChurchUserDeletionAuthorizationError extends Error {}
export class ChurchUserDeletionConfirmationError extends Error {}
export class ChurchUserDeletionNotFoundError extends Error {}
export class ChurchUserDeletionFailedError extends Error {}

export interface DeleteChurchUserStore {
  canDelete(adminUserId: string): Promise<boolean>;
  findTarget(
    churchId: string,
    userId: string,
  ): Promise<{ email: string } | null>;
  deleteVerifications(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export function createChurchUserDeleter(dependencies: {
  runTransaction<T>(
    operation: (store: DeleteChurchUserStore) => Promise<T>,
  ): Promise<T>;
}) {
  return async function deleteChurchUser(
    actorAdminUserId: string,
    churchId: string,
    userId: string,
    confirmationEmail: string,
  ): Promise<void> {
    try {
      await dependencies.runTransaction(async (store) => {
        if (!(await store.canDelete(actorAdminUserId)))
          throw new ChurchUserDeletionAuthorizationError();
        const target = await store.findTarget(churchId, userId);
        if (!target) throw new ChurchUserDeletionNotFoundError();
        if (
          target.email.toLowerCase() !== confirmationEmail.trim().toLowerCase()
        )
          throw new ChurchUserDeletionConfirmationError();
        await store.deleteVerifications(userId);
        await store.deleteUser(userId);
      });
    } catch (error) {
      if (
        error instanceof ChurchUserDeletionAuthorizationError ||
        error instanceof ChurchUserDeletionConfirmationError ||
        error instanceof ChurchUserDeletionNotFoundError
      )
        throw error;
      throw new ChurchUserDeletionFailedError();
    }
  };
}
