import type { OperatorAccess } from "@/application/auth/operator-access";
import {
  ChurchDeletionAuthorizationError,
  ChurchDeletionConfirmationError,
  ChurchDeletionNotFoundError,
} from "./delete-church";

export type DeleteChurchState =
  { status: "idle" } | { message: string; status: "error" | "success" };

export function createDeleteChurchController(dependencies: {
  deleteChurch(
    actorAdminUserId: string,
    targetChurchId: string,
    confirmationName: string,
  ): Promise<void>;
  getOperatorAccess(headers: Headers): Promise<OperatorAccess>;
  recordEvent(event: {
    actorAdminUserId?: string;
    outcome: "denied" | "failed" | "succeeded" | "validation_failed";
    requestId?: string;
    targetChurchId?: string;
  }): void;
}) {
  return async function handle(
    headers: Headers,
    rawChurchId: unknown,
    rawConfirmationName: unknown,
    requestId?: string,
  ): Promise<DeleteChurchState> {
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

    const targetChurchId =
      typeof rawChurchId === "string" ? rawChurchId.trim() : "";
    const confirmationName =
      typeof rawConfirmationName === "string" ? rawConfirmationName.trim() : "";
    if (!targetChurchId || !confirmationName) {
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: "validation_failed",
        ...(targetChurchId && { targetChurchId }),
        ...(requestId && { requestId }),
      });
      return {
        message: targetChurchId
          ? "確認のため教会名を入力してください。"
          : "削除する教会を選択してください。",
        status: "error",
      };
    }

    try {
      await dependencies.deleteChurch(
        access.adminUserId,
        targetChurchId,
        confirmationName,
      );
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: "succeeded",
        targetChurchId,
        ...(requestId && { requestId }),
      });
      return { message: "教会を削除しました。", status: "success" };
    } catch (error) {
      const denied = error instanceof ChurchDeletionAuthorizationError;
      const validationFailed = error instanceof ChurchDeletionConfirmationError;
      dependencies.recordEvent({
        actorAdminUserId: access.adminUserId,
        outcome: denied
          ? "denied"
          : validationFailed
            ? "validation_failed"
            : "failed",
        targetChurchId,
        ...(requestId && { requestId }),
      });
      const message = validationFailed
        ? "教会名が一致しません。表示されている教会名を入力してください。"
        : error instanceof ChurchDeletionNotFoundError
          ? "対象の教会は既に削除されています。"
          : denied
            ? "この操作を実行できません。再度ログインしてください。"
            : "教会を削除できませんでした。もう一度お試しください。";
      return { message, status: "error" };
    }
  };
}
