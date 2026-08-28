import {
  parseChurchUserInvitationInput,
  type ChurchUserInvitationFieldErrors,
} from "./church-user-invitation-input";

export class ChurchUserInvitationAuthorizationError extends Error {}
export class ChurchUserInvitationInputError extends Error {
  constructor(readonly fieldErrors: ChurchUserInvitationFieldErrors) {
    super("Church user invitation input is invalid");
  }
}
export class ChurchUserInvitationFailedError extends Error {}

export interface InviteChurchUserResult {
  churchId: string;
  churchName: string;
  email: string;
  userId: string;
}

export interface InviteChurchUserTransaction {
  createChurchMembership(churchId: string, userId: string): Promise<void>;
  createCredential(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ userId: string }>;
  findActiveChurch(
    churchId: string,
  ): Promise<{ id: string; name: string } | null>;
  findActiveOperator(userId: string): Promise<boolean>;
  isPendingUser(userId: string): Promise<boolean>;
}

export interface InviteChurchUserDependencies {
  generatePassword(): string;
  removeUnsentInvitation(userId: string): Promise<void>;
  runTransaction<T>(
    operation: (transaction: InviteChurchUserTransaction) => Promise<T>,
  ): Promise<T>;
  sendInvitation(email: string): Promise<void>;
}

export function createChurchUserInviter(
  dependencies: InviteChurchUserDependencies,
) {
  return async function inviteChurchUser(
    operatorUserId: string,
    rawInput: { accountName: unknown; churchId: unknown; email: unknown },
  ): Promise<InviteChurchUserResult> {
    const input = parseChurchUserInvitationInput(rawInput);
    if (!input.success) throw new ChurchUserInvitationInputError(input.errors);

    let result: InviteChurchUserResult;
    try {
      result = await dependencies.runTransaction(async (transaction) => {
        if (!(await transaction.findActiveOperator(operatorUserId)))
          throw new ChurchUserInvitationAuthorizationError();
        const church = await transaction.findActiveChurch(input.data.churchId);
        if (!church) throw new ChurchUserInvitationFailedError();
        const credential = await transaction.createCredential({
          email: input.data.email,
          name: input.data.accountName,
          password: dependencies.generatePassword(),
        });
        if (!(await transaction.isPendingUser(credential.userId)))
          throw new ChurchUserInvitationFailedError();
        await transaction.createChurchMembership(church.id, credential.userId);
        return {
          churchId: church.id,
          churchName: church.name,
          email: input.data.email,
          userId: credential.userId,
        };
      });
    } catch (error) {
      if (error instanceof ChurchUserInvitationAuthorizationError) throw error;
      throw new ChurchUserInvitationFailedError();
    }

    try {
      await dependencies.sendInvitation(result.email);
      return result;
    } catch {
      try {
        await dependencies.removeUnsentInvitation(result.userId);
      } catch {
        // Keep the original delivery failure as the actionable outcome.
      }
      throw new ChurchUserInvitationFailedError();
    }
  };
}
