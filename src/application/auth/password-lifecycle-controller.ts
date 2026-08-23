import type { OperatorAccess } from "./operator-access";
import {
  PasswordLifecycleAuthorizationError,
  PasswordLifecycleInputError,
  type ResetChurchPasswordResult,
} from "./password-lifecycle";

export type ResetPasswordState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "success";
      churchName: string;
      email: string;
      temporaryPassword: string;
      message: string;
    };

export type ChangePasswordState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export type PasswordLifecycleAuditEvent = {
  actorUserId?: string;
  operation: "change" | "reset";
  outcome: "denied" | "failed" | "succeeded" | "validation_failed";
  requestId?: string;
  targetChurchId?: string;
  targetUserId?: string;
};

function withRequestId(requestId?: string) {
  return requestId ? { requestId } : {};
}

export function createResetPasswordController(dependencies: {
  getOperatorAccess(headers: Headers): Promise<OperatorAccess>;
  recordEvent(event: PasswordLifecycleAuditEvent): void;
  resetChurchPassword(
    operatorUserId: string,
    churchId: string,
  ): Promise<ResetChurchPasswordResult>;
}) {
  return async function resetPassword(
    headers: Headers,
    input: { churchId: unknown; confirmed: unknown },
    requestId?: string,
  ): Promise<ResetPasswordState> {
    const access = await dependencies.getOperatorAccess(headers);
    if (access.status !== "authorized") {
      dependencies.recordEvent({
        ...(access.status === "forbidden"
          ? { actorUserId: access.userId }
          : {}),
        operation: "reset",
        outcome: "denied",
        ...withRequestId(requestId),
      });
      return { status: "error", message: "この操作を実行できません。" };
    }
    const churchId = String(input.churchId ?? "");
    if (input.confirmed !== "yes") {
      dependencies.recordEvent({
        actorUserId: access.userId,
        operation: "reset",
        outcome: "validation_failed",
        ...withRequestId(requestId),
      });
      return { status: "error", message: "確認欄を選択してください。" };
    }
    try {
      const result = await dependencies.resetChurchPassword(
        access.userId,
        churchId,
      );
      dependencies.recordEvent({
        actorUserId: access.userId,
        operation: "reset",
        outcome: "succeeded",
        ...withRequestId(requestId),
        targetChurchId: result.churchId,
        targetUserId: result.userId,
      });
      return {
        status: "success",
        churchName: result.churchName,
        email: result.email,
        temporaryPassword: result.temporaryPassword,
        message: "パスワードを再設定し、すべてのセッションを失効しました。",
      };
    } catch {
      dependencies.recordEvent({
        actorUserId: access.userId,
        operation: "reset",
        outcome: "failed",
        ...withRequestId(requestId),
      });
      return {
        status: "error",
        message: "再設定できませんでした。対象と状態を確認してください。",
      };
    }
  };
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
