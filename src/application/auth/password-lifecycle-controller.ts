import {
  PasswordLifecycleAuthorizationError,
  PasswordLifecycleInputError,
} from "./password-lifecycle";

export type ChangePasswordState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export type PasswordLifecycleAuditEvent = {
  actorUserId?: string;
  operation: "change";
  outcome: "denied" | "failed" | "succeeded" | "validation_failed";
  requestId?: string;
  targetUserId?: string;
};

function withRequestId(requestId?: string) {
  return requestId ? { requestId } : {};
}

export function createChangePasswordController(dependencies: {
  completeForcedPasswordChange(input: {
    newPassword: unknown;
    confirmation: unknown;
    sessionId: string;
    userId: string;
  }): Promise<void>;
  getForcedPasswordChangeSession(
    headers: Headers,
  ): Promise<{ sessionId: string; userId: string } | null>;
  recordEvent(event: PasswordLifecycleAuditEvent): void;
}) {
  return async function changePassword(
    headers: Headers,
    input: { newPassword: unknown; confirmation: unknown },
    requestId?: string,
  ): Promise<ChangePasswordState> {
    const session = await dependencies.getForcedPasswordChangeSession(headers);
    if (!session) {
      dependencies.recordEvent({
        operation: "change",
        outcome: "denied",
        ...withRequestId(requestId),
      });
      return {
        status: "error",
        message: "この操作を実行できません。再度ログインしてください。",
      };
    }
    try {
      await dependencies.completeForcedPasswordChange({ ...input, ...session });
      dependencies.recordEvent({
        actorUserId: session.userId,
        operation: "change",
        outcome: "succeeded",
        ...withRequestId(requestId),
        targetUserId: session.userId,
      });
      return {
        status: "success",
        message:
          "パスワードを変更しました。他のセッションはすべて失効しました。",
      };
    } catch (error) {
      const inputError = error instanceof PasswordLifecycleInputError;
      const authorizationError =
        error instanceof PasswordLifecycleAuthorizationError;
      dependencies.recordEvent({
        actorUserId: session.userId,
        operation: "change",
        outcome: inputError
          ? "validation_failed"
          : authorizationError
            ? "denied"
            : "failed",
        ...withRequestId(requestId),
        targetUserId: session.userId,
      });
      return inputError
        ? {
            status: "error",
            message:
              "12〜128文字の新しいパスワードを一致させて入力してください。",
          }
        : {
            status: "error",
            message: authorizationError
              ? "セッションが無効です。再度ログインしてください。"
              : "パスワードを変更できませんでした。もう一度お試しください。",
          };
    }
  };
}
