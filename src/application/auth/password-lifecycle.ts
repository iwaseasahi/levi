export class PasswordLifecycleAuthorizationError extends Error {}
export class PasswordLifecycleInputError extends Error {}
export class PasswordLifecycleFailedError extends Error {}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ResetChurchPasswordResult {
  churchId: string;
  churchName: string;
  email: string;
  temporaryPassword: string;
  userId: string;
}

export interface PasswordLifecycleTransaction {
  clearForcedPasswordChange(userId: string): Promise<void>;
  findActiveOperator(userId: string): Promise<boolean>;
  findForcedChangeAccount(input: {
    sessionId: string;
    userId: string;
  }): Promise<{ accountId: string } | null>;
  findResetTarget(userId: string): Promise<{
    churchId: string;
    churchName: string;
    email: string;
    userId: string;
  } | null>;
  markForcedPasswordChange(userId: string): Promise<void>;
  replaceCredentialPassword(userId: string, hash: string): Promise<boolean>;
  revokeAllSessions(userId: string): Promise<void>;
  revokeOtherSessions(userId: string, sessionId: string): Promise<void>;
  updateCredentialPassword(accountId: string, hash: string): Promise<void>;
}

export interface PasswordLifecycleDependencies {
  findActiveOperator(userId: string): Promise<boolean>;
  generateTemporaryPassword(): string;
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
  async function resetChurchPassword(
    operatorUserId: string,
    userId: string,
  ): Promise<ResetChurchPasswordResult> {
    if (!UUID_PATTERN.test(userId)) throw new PasswordLifecycleInputError();
    if (!UUID_PATTERN.test(operatorUserId))
      throw new PasswordLifecycleAuthorizationError();

    let operatorIsActive = false;
    try {
      operatorIsActive = await dependencies.findActiveOperator(operatorUserId);
    } catch {
      throw new PasswordLifecycleFailedError();
    }
    if (!operatorIsActive) throw new PasswordLifecycleAuthorizationError();

    const temporaryPassword = dependencies.generateTemporaryPassword();
    const passwordHash = await dependencies.hashPassword(temporaryPassword);
    try {
      return await dependencies.runTransaction(async (transaction) => {
        if (!(await transaction.findActiveOperator(operatorUserId)))
          throw new PasswordLifecycleAuthorizationError();
        const target = await transaction.findResetTarget(userId);
        if (!target) throw new PasswordLifecycleFailedError();
        if (
          !(await transaction.replaceCredentialPassword(
            target.userId,
            passwordHash,
          ))
        )
          throw new PasswordLifecycleFailedError();
        await transaction.markForcedPasswordChange(target.userId);
        await transaction.revokeAllSessions(target.userId);
        return { ...target, temporaryPassword };
      });
    } catch (error) {
      if (error instanceof PasswordLifecycleAuthorizationError) throw error;
      throw new PasswordLifecycleFailedError();
    }
  }

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

  return { completeForcedPasswordChange, resetChurchPassword };
}
