import type { OperatorAccess } from "@/application/auth/operator-access";
import {
  AdminUserDeletionAuthorizationError,
  AdminUserDeletionBootstrapError,
  AdminUserDeletionLastActiveError,
  AdminUserDeletionNotFoundError,
  AdminUserDeletionSelfError,
} from "./delete-admin-user";

export type DeleteAdminUserState =
  { status: "idle" } | { message: string; status: "error" | "success" };

export function createDeleteAdminUserController(dependencies: {
  deleteAdminUser(
    actorAdminUserId: string,
    targetAdminUserId: string,
  ): Promise<void>;
  getOperatorAccess(headers: Headers): Promise<OperatorAccess>;
  recordEvent(event: {
    actorAdminUserId?: string;
    outcome: "denied" | "failed" | "succeeded" | "validation_failed";
    requestId?: string;
    targetAdminUserId?: string;
  }): void;
}) {
  return async function handle(
    headers: Headers,
    rawAdminUserId: unknown,
    requestId?: string,
  ): Promise<DeleteAdminUserState> {
    const access = await dependencies.getOperatorAccess(headers);
    if (access.status !== "authorized") {
      dependencies.recordEvent({
        outcome: "denied",
        ...(requestId && { requestId }),
      });
      return {
        message: "この操作を実行できません。再度ログインしてください。",
        status: "error",
      };
    }

    const targetAdminUserId =
      typeof rawAdminUserId === "string" ? rawAdminUserId.trim() : "";
    if (!targetAdminUserId) {
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: "validation_failed",
        ...(requestId && { requestId }),
      });
      return { message: "削除する管理者を選択してください。", status: "error" };
    }

    try {
      await dependencies.deleteAdminUser(access.adminUserId, targetAdminUserId);
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: "succeeded",
        targetAdminUserId,
        ...(requestId && { requestId }),
      });
      return { message: "管理者を削除しました。", status: "success" };
    } catch (error) {
      const denied = error instanceof AdminUserDeletionAuthorizationError;
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: denied ? "denied" : "failed",
        targetAdminUserId,
        ...(requestId && { requestId }),
      });
      const message =
        error instanceof AdminUserDeletionSelfError
          ? "現在ログイン中の管理者は削除できません。"
          : error instanceof AdminUserDeletionLastActiveError
            ? "最後の有効な管理者は削除できません。"
            : error instanceof AdminUserDeletionBootstrapError
              ? "Basic認証用の管理者は削除できません。"
              : error instanceof AdminUserDeletionNotFoundError
                ? "対象の管理者は既に削除されています。"
                : denied
                  ? "この操作を実行できません。再度ログインしてください。"
                  : "管理者を削除できませんでした。もう一度お試しください。";
      return { message, status: "error" };
    }
  };
}
