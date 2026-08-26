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
  email: string;
  loginId: string;
  name: string;
}

export interface InviteAdminUserStore {
  create(input: {
    email: string;
    invitedByAdminUserId: string;
    loginId: string;
    name: string;
    passwordHash: string;
  }): Promise<{ email: string; id: string; loginId: string; name: string }>;
  canInvite(adminUserId: string): Promise<boolean>;
}

export function createAdminUserInviter(dependencies: {
  removeUnsentInvitation(adminUserId: string): Promise<void>;
  generatePassword(): string;
  hashPassword(password: string): Promise<string>;
  sendInvitation(email: string): Promise<void>;
  runTransaction<T>(
    operation: (store: InviteAdminUserStore) => Promise<T>,
  ): Promise<T>;
}) {
  return async function inviteAdminUser(
    actorAdminUserId: string,
    rawInput: { email: unknown; loginId: unknown; name: unknown },
  ): Promise<InviteAdminUserResult> {
    const parsed = parseAdminUserInvitationInput(rawInput);
    if (!parsed.success) throw new AdminUserInvitationInputError(parsed.errors);

    const temporaryPassword = dependencies.generatePassword();
    const passwordHash = await dependencies.hashPassword(temporaryPassword);

    let adminUser: {
      email: string;
      id: string;
      loginId: string;
      name: string;
    };
    try {
      adminUser = await dependencies.runTransaction(async (store) => {
        if (!(await store.canInvite(actorAdminUserId)))
          throw new AdminUserInvitationAuthorizationError();
        return store.create({
          invitedByAdminUserId: actorAdminUserId,
          email: parsed.data.email,
          loginId: parsed.data.loginId,
          name: parsed.data.name,
          passwordHash,
        });
      });
    } catch (error) {
      if (
        error instanceof AdminUserInvitationAuthorizationError ||
        error instanceof AdminUserInvitationDuplicateError ||
        error instanceof AdminUserInvitationFailedError
      )
        throw error;
      throw new AdminUserInvitationFailedError();
    }

    try {
      await dependencies.sendInvitation(adminUser.email);
    } catch {
      await dependencies.removeUnsentInvitation(adminUser.id).catch(() => {});
      throw new AdminUserInvitationFailedError();
    }

    return { ...adminUser, adminUserId: adminUser.id };
  };
}
