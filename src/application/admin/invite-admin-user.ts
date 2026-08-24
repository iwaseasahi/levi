import {
  parseAdminUserInvitationInput,
  type AdminUserInvitationFieldErrors,
} from "./admin-user-invitation-input";

export class AdminUserInvitationAuthorizationError extends Error {}
export class AdminUserInvitationDuplicateError extends Error {}
export class AdminUserInvitationFailedError extends Error {}
export class AdminUserInvitationInputError extends Error {
  constructor(readonly fieldErrors: AdminUserInvitationFieldErrors) {
    super("Admin user invitation input is invalid");
  }
}

export interface InviteAdminUserResult {
  adminUserId: string;
  loginId: string;
  name: string;
  temporaryPassword: string;
}

export interface InviteAdminUserStore {
  create(input: {
    invitedByAdminUserId: string;
    loginId: string;
    name: string;
    passwordHash: string;
  }): Promise<{ id: string; loginId: string; name: string }>;
  canInvite(adminUserId: string): Promise<boolean>;
}

export function createAdminUserInviter(dependencies: {
  generatePassword(): string;
  hashPassword(password: string): Promise<string>;
  runTransaction<T>(
    operation: (store: InviteAdminUserStore) => Promise<T>,
  ): Promise<T>;
}) {
  return async function inviteAdminUser(
    actorAdminUserId: string,
    rawInput: { loginId: unknown; name: unknown },
  ): Promise<InviteAdminUserResult> {
    const parsed = parseAdminUserInvitationInput(rawInput);
    if (!parsed.success) throw new AdminUserInvitationInputError(parsed.errors);

    const temporaryPassword = dependencies.generatePassword();
    const passwordHash = await dependencies.hashPassword(temporaryPassword);

    try {
      return await dependencies.runTransaction(async (store) => {
        if (!(await store.canInvite(actorAdminUserId)))
          throw new AdminUserInvitationAuthorizationError();
        const adminUser = await store.create({
          invitedByAdminUserId: actorAdminUserId,
          loginId: parsed.data.loginId,
          name: parsed.data.name,
          passwordHash,
        });
        return { ...adminUser, adminUserId: adminUser.id, temporaryPassword };
      });
    } catch (error) {
      if (
        error instanceof AdminUserInvitationAuthorizationError ||
        error instanceof AdminUserInvitationDuplicateError
      )
        throw error;
      throw new AdminUserInvitationFailedError();
    }
  };
}
