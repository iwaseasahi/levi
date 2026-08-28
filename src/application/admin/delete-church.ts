export class ChurchDeletionAuthorizationError extends Error {}
export class ChurchDeletionConfirmationError extends Error {}
export class ChurchDeletionFailedError extends Error {}
export class ChurchDeletionNotFoundError extends Error {}

export interface ChurchDeletionTarget {
  name: string;
  userIds: string[];
}

export interface DeleteChurchStore {
  canDelete(adminUserId: string): Promise<boolean>;
  deleteChurch(churchId: string): Promise<void>;
  deleteUserVerifications(userIds: string[]): Promise<void>;
  deleteUsers(userIds: string[]): Promise<void>;
  findTarget(churchId: string): Promise<ChurchDeletionTarget | null>;
}

const knownErrors = [
  ChurchDeletionAuthorizationError,
  ChurchDeletionConfirmationError,
  ChurchDeletionNotFoundError,
] as const;

export function createChurchDeleter(dependencies: {
  runTransaction<T>(
    operation: (store: DeleteChurchStore) => Promise<T>,
  ): Promise<T>;
}) {
  return async function deleteChurch(
    actorAdminUserId: string,
    targetChurchId: string,
    confirmationName: string,
  ): Promise<void> {
    try {
      await dependencies.runTransaction(async (store) => {
        if (!(await store.canDelete(actorAdminUserId)))
          throw new ChurchDeletionAuthorizationError();

        const target = await store.findTarget(targetChurchId);
        if (!target) throw new ChurchDeletionNotFoundError();
        if (target.name !== confirmationName)
          throw new ChurchDeletionConfirmationError();

        await store.deleteChurch(targetChurchId);
        if (target.userIds.length > 0) {
          await store.deleteUserVerifications(target.userIds);
          await store.deleteUsers(target.userIds);
        }
      });
    } catch (error) {
      if (knownErrors.some((ErrorType) => error instanceof ErrorType))
        throw error;
      throw new ChurchDeletionFailedError();
    }
  };
}
