export class AdminUserDeletionAuthorizationError extends Error {}
export class AdminUserDeletionBootstrapError extends Error {}
export class AdminUserDeletionFailedError extends Error {}
export class AdminUserDeletionLastActiveError extends Error {}
export class AdminUserDeletionNotFoundError extends Error {}
export class AdminUserDeletionSelfError extends Error {}

export interface DeleteAdminUserStore {
  canDelete(adminUserId: string): Promise<boolean>;
  countActive(): Promise<number>;
  delete(adminUserId: string): Promise<void>;
  findStatus(
    adminUserId: string,
  ): Promise<"ACTIVE" | "BOOTSTRAP" | "INVITED" | "SUSPENDED" | null>;
  removeInviterReferences(adminUserId: string): Promise<void>;
}

const knownErrors = [
  AdminUserDeletionAuthorizationError,
  AdminUserDeletionBootstrapError,
  AdminUserDeletionLastActiveError,
  AdminUserDeletionNotFoundError,
  AdminUserDeletionSelfError,
] as const;

export function createAdminUserDeleter(dependencies: {
  runTransaction<T>(
    operation: (store: DeleteAdminUserStore) => Promise<T>,
  ): Promise<T>;
}) {
  return async function deleteAdminUser(
    actorAdminUserId: string,
    targetAdminUserId: string,
  ): Promise<void> {
    try {
      await dependencies.runTransaction(async (store) => {
        if (!(await store.canDelete(actorAdminUserId)))
          throw new AdminUserDeletionAuthorizationError();
        if (actorAdminUserId === targetAdminUserId)
          throw new AdminUserDeletionSelfError();

        const targetStatus = await store.findStatus(targetAdminUserId);
        if (!targetStatus) throw new AdminUserDeletionNotFoundError();
        if (targetStatus === "BOOTSTRAP")
          throw new AdminUserDeletionBootstrapError();
        if (targetStatus === "ACTIVE" && (await store.countActive()) <= 1)
          throw new AdminUserDeletionLastActiveError();

        await store.removeInviterReferences(targetAdminUserId);
        await store.delete(targetAdminUserId);
      });
    } catch (error) {
      if (knownErrors.some((ErrorType) => error instanceof ErrorType))
        throw error;
      throw new AdminUserDeletionFailedError();
    }
  };
}
