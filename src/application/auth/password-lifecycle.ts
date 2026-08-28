export class PasswordLifecycleAuthorizationError extends Error {}
export class PasswordLifecycleInputError extends Error {}
export class PasswordLifecycleFailedError extends Error {}

export interface PasswordLifecycleTransaction {
  clearForcedPasswordChange(userId: string): Promise<void>;
  findForcedChangeAccount(input: {
    sessionId: string;
    userId: string;
  }): Promise<{ accountId: string } | null>;
  revokeOtherSessions(userId: string, sessionId: string): Promise<void>;
  updateCredentialPassword(accountId: string, hash: string): Promise<void>;
}

export interface PasswordLifecycleDependencies {
  hashPassword(password: string): Promise<string>;
  runTransaction<T>(
    operation: (transaction: PasswordLifecycleTransaction) => Promise<T>,
  ): Promise<T>;
}

function validPassword(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const length = Array.from(value).length;
  return length >= 12 && length <= 128;
}

export function createPasswordLifecycle(
  dependencies: PasswordLifecycleDependencies,
) {
  async function completeForcedPasswordChange(input: {
    newPassword: unknown;
    confirmation: unknown;
    sessionId: string;
    userId: string;
  }) {
    if (
      !validPassword(input.newPassword) ||
      input.newPassword !== input.confirmation
    )
      throw new PasswordLifecycleInputError();
    const newPassword = input.newPassword;
    try {
      await dependencies.runTransaction(async (transaction) => {
        const account = await transaction.findForcedChangeAccount(input);
        if (!account) throw new PasswordLifecycleAuthorizationError();
        const newHash = await dependencies.hashPassword(newPassword);
        await transaction.updateCredentialPassword(account.accountId, newHash);
        await transaction.clearForcedPasswordChange(input.userId);
        await transaction.revokeOtherSessions(input.userId, input.sessionId);
      });
    } catch (error) {
      if (error instanceof PasswordLifecycleAuthorizationError) throw error;
      throw new PasswordLifecycleFailedError();
    }
  }

  return { completeForcedPasswordChange };
}
