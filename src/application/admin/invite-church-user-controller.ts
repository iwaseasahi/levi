import type { OperatorAccess } from "@/application/auth/operator-access";
import {
  ChurchUserInvitationAuthorizationError,
  ChurchUserInvitationInputError,
  type InviteChurchUserResult,
} from "./invite-church-user";
import {
  parseChurchUserInvitationInput,
  type ChurchUserInvitationFieldErrors,
} from "./church-user-invitation-input";

export type InviteChurchUserFormState =
  | { status: "idle" }
  | {
      fieldErrors: ChurchUserInvitationFieldErrors;
      message: string;
      status: "validation-error";
    }
  | { message: string; status: "not-authorized" | "server-error" }
  | {
      churchName: string;
      email: string;
      message: string;
      status: "success";
    };

interface Dependencies {
  getOperatorAccess(headers: Headers): Promise<OperatorAccess>;
  inviteChurchUser(
    operatorUserId: string,
    input: { accountName: unknown; churchId: unknown; email: unknown },
  ): Promise<InviteChurchUserResult>;
  recordEvent(event: {
    actorAdminUserId?: string;
    outcome: "denied" | "failed" | "succeeded" | "validation_failed";
    requestId?: string;
    targetChurchId?: string;
    targetUserId?: string;
  }): void;
}

export function createInviteChurchUserController(dependencies: Dependencies) {
  return async function handle(
    headers: Headers,
    rawInput: { accountName: unknown; churchId: unknown; email: unknown },
    requestId?: string,
  ): Promise<InviteChurchUserFormState> {
    const access = await dependencies.getOperatorAccess(headers);
    if (access.status !== "authorized") {
      dependencies.recordEvent({
        ...(access.status === "forbidden"
          ? { actorAdminUserId: access.adminUserId }
          : {}),
        outcome: "denied",
        ...(requestId ? { requestId } : {}),
      });
      return {
        message: "この操作を実行できません。再度ログインしてください。",
        status: "not-authorized",
      };
    }

    const parsed = parseChurchUserInvitationInput(rawInput);
    if (!parsed.success) {
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: "validation_failed",
        ...(requestId ? { requestId } : {}),
      });
      return {
        fieldErrors: parsed.errors,
        message: "入力内容を確認してください。",
        status: "validation-error",
      };
    }

    try {
      const result = await dependencies.inviteChurchUser(
        access.adminUserId,
        parsed.data,
      );
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: "succeeded",
        ...(requestId ? { requestId } : {}),
        targetChurchId: result.churchId,
        targetUserId: result.userId,
      });
      return {
        churchName: result.churchName,
        email: result.email,
        message: "教会利用者へ招待メールを送信しました。",
        status: "success",
      };
    } catch (error) {
      if (error instanceof ChurchUserInvitationInputError) {
        return {
          fieldErrors: error.fieldErrors,
          message: "入力内容を確認してください。",
          status: "validation-error",
        };
      }
      const denied = error instanceof ChurchUserInvitationAuthorizationError;
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: denied ? "denied" : "failed",
        ...(requestId ? { requestId } : {}),
        targetChurchId: parsed.data.churchId,
      });
      return {
        message: denied
          ? "この操作を実行できません。再度ログインしてください。"
          : "招待できませんでした。教会の状態と入力内容を確認してください。",
        status: denied ? "not-authorized" : "server-error",
      };
    }
  };
}
