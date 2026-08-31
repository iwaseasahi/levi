import { z } from "zod";
import type { OperatorAccess } from "@/application/auth/operator-access";
import {
  ChurchUserDeletionAuthorizationError,
  ChurchUserDeletionConfirmationError,
  ChurchUserDeletionNotFoundError,
} from "./delete-church-user";

export type DeleteChurchUserState =
  { status: "idle" } | { message: string; status: "error" | "success" };

const inputSchema = z.object({
  churchId: z.uuid(),
  userId: z.uuid(),
  confirmationEmail: z.string().trim().toLowerCase().email().max(254),
});

export function createDeleteChurchUserController(dependencies: {
  deleteChurchUser(
    actorId: string,
    churchId: string,
    userId: string,
    email: string,
  ): Promise<void>;
  getOperatorAccess(headers: Headers): Promise<OperatorAccess>;
  recordEvent(event: {
    actorAdminUserId?: string;
    targetChurchId?: string;
    targetUserId?: string;
    outcome: "denied" | "validation_failed" | "failed" | "succeeded";
    requestId?: string;
  }): void;
}) {
  return async function handle(
    headers: Headers,
    rawInput: unknown,
    requestId?: string,
  ): Promise<DeleteChurchUserState> {
    const access = await dependencies.getOperatorAccess(headers);
    const request = requestId ? { requestId } : {};
    if (access.status !== "authorized") {
      dependencies.recordEvent({ ...request, outcome: "denied" });
      return {
        status: "error",
        message: "この操作を実行できません。再度ログインしてください。",
      };
    }
    const actor = { ...request, actorAdminUserId: access.adminUserId };
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      dependencies.recordEvent({ ...actor, outcome: "validation_failed" });
      return {
        status: "error",
        message: "対象の利用者と確認用メールアドレスを確認してください。",
      };
    }
    const { churchId, userId, confirmationEmail } = parsed.data;
    const event = { ...actor, targetChurchId: churchId, targetUserId: userId };
    try {
      await dependencies.deleteChurchUser(
        access.adminUserId,
        churchId,
        userId,
        confirmationEmail,
      );
      dependencies.recordEvent({ ...event, outcome: "succeeded" });
      return { status: "success", message: "利用者を削除しました。" };
    } catch (error) {
      const denied = error instanceof ChurchUserDeletionAuthorizationError;
      const mismatch = error instanceof ChurchUserDeletionConfirmationError;
      dependencies.recordEvent({
        ...event,
        outcome: denied ? "denied" : mismatch ? "validation_failed" : "failed",
      });
      return {
        status: "error",
        message: denied
          ? "この操作を実行できません。再度ログインしてください。"
          : mismatch
            ? "メールアドレスが一致しません。対象の利用者を確認してください。"
            : error instanceof ChurchUserDeletionNotFoundError
              ? "この教会に対象の利用者が見つかりません。一覧を再読み込みしてください。"
              : "利用者を削除できませんでした。もう一度お試しください。",
      };
    }
  };
}
