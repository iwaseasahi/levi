export class InvitationResendAuthorizationError extends Error {}
export class InvitationResendUnavailableError extends Error {}
export class InvitationResendRateLimitError extends Error {}

export interface InvitationResendStore {
  canManage(adminUserId: string): Promise<boolean>;
  findPendingRecipient(
    churchId: string,
    userId: string,
  ): Promise<string | null>;
  consumeResend(userId: string): Promise<boolean>;
  replaceInvitation(userId: string, email: string): Promise<void>;
}

export function createChurchUserInvitationResender(dependencies: {
  runTransaction<T>(
    operation: (store: InvitationResendStore) => Promise<T>,
  ): Promise<T>;
}) {
  return async (adminUserId: string, churchId: string, userId: string) => {
    await dependencies.runTransaction(async (store) => {
      if (!(await store.canManage(adminUserId)))
        throw new InvitationResendAuthorizationError();
      const email = await store.findPendingRecipient(churchId, userId);
      if (!email) throw new InvitationResendUnavailableError();
      if (!(await store.consumeResend(userId)))
        throw new InvitationResendRateLimitError();
      await store.replaceInvitation(userId, email);
    });
  };
}
