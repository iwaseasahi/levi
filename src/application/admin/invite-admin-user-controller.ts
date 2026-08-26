import type { OperatorAccess } from "@/application/auth/operator-access";
import {
  AdminUserInvitationAuthorizationError,
  AdminUserInvitationDuplicateError,
  AdminUserInvitationInputError,
  type InviteAdminUserResult,
} from "./invite-admin-user";
import {
  parseAdminUserInvitationInput,
  type AdminUserInvitationFieldErrors,
} from "./admin-user-invitation-input";

export type InviteAdminUserFormState =
  | { status: "idle" }
  | {
      fieldErrors: AdminUserInvitationFieldErrors;
      message: string;
      status: "validation-error";
    }
  | { message: string; status: "not-authorized" | "server-error" }
  | {
      email: string;
      message: string;
      name: string;
      status: "success";
    };

export function createInviteAdminUserController(dependencies: {
  getOperatorAccess(headers: Headers): Promise<OperatorAccess>;
  inviteAdminUser(
    actorAdminUserId: string,
    input: { email: unknown; name: unknown },
  ): Promise<InviteAdminUserResult>;
  recordEvent(event: {
    actorAdminUserId?: string;
    outcome: "denied" | "failed" | "succeeded" | "validation_failed";
    requestId?: string;
    targetAdminUserId?: string;
  }): void;
}) {
  return async function handle(
    headers: Headers,
    rawInput: { email: unknown; name: unknown },
    requestId?: string,
  ): Promise<InviteAdminUserFormState> {
    const access = await dependencies.getOperatorAccess(headers);
    if (access.status !== "authorized") {
      dependencies.recordEvent({
        outcome: "denied",
        ...(requestId && { requestId }),
      });
      return {
        message: "この操作を実行できません。再度ログインしてください。",
        status: "not-authorized",
      };
    }
    const parsed = parseAdminUserInvitationInput(rawInput);
    if (!parsed.success) {
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: "validation_failed",
        ...(requestId && { requestId }),
      });
      return {
        fieldErrors: parsed.errors,
        message: "入力内容を確認してください。",
        status: "validation-error",
      };
    }
    try {
      const result = await dependencies.inviteAdminUser(
        access.adminUserId,
        parsed.data,
      );
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: "succeeded",
        targetAdminUserId: result.adminUserId,
        ...(requestId && { requestId }),
      });
      return {
        email: result.email,
        message: "管理者へ招待メールを送信しました。",
        name: result.name,
        status: "success",
      };
    } catch (error) {
      if (error instanceof AdminUserInvitationInputError)
        return {
          fieldErrors: error.fieldErrors,
          message: "入力内容を確認してください。",
          status: "validation-error",
        };
      const denied = error instanceof AdminUserInvitationAuthorizationError;
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: denied ? "denied" : "failed",
        ...(requestId && { requestId }),
      });
      if (denied)
        return {
          message: "この操作を実行できません。再度ログインしてください。",
          status: "not-authorized",
        };
      return {
        message:
          error instanceof AdminUserInvitationDuplicateError
            ? "このメールアドレスは既に使用されています。"
            : "招待できませんでした。もう一度お試しください。",
        status: "server-error",
      };
    }
  };
}
