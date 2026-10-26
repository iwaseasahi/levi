import { z } from "zod";
import type { OperatorAccess } from "@/application/auth/operator-access";
import {
  InvitationResendAuthorizationError,
  InvitationResendRateLimitError,
  InvitationResendUnavailableError,
} from "./resend-church-user-invitation";

export type ResendInvitationState =
  { status: "idle" } | { status: "success" | "error"; message: string };

const schema = z.object({ churchId: z.uuid(), userId: z.uuid() });
const deniedMessage = "この操作を実行できません。再度ログインしてください。";

export function createResendChurchUserInvitationController(dependencies: {
  getOperatorAccess(headers: Headers): Promise<OperatorAccess>;
  resendInvitation(
    adminUserId: string,
    churchId: string,
    userId: string,
  ): Promise<void>;
  recordEvent(event: {
    actorAdminUserId?: string;
    targetChurchId?: string;
    targetUserId?: string;
    outcome:
      "denied" | "validation_failed" | "failed" | "succeeded" | "rate_limited";
    requestId?: string;
  }): void;
}) {
  return async (
    headers: Headers,
    input: unknown,
    requestId?: string,
  ): Promise<ResendInvitationState> => {
    const access = await dependencies.getOperatorAccess(headers);
    const request = requestId ? { requestId } : {};
    if (access.status !== "authorized") {
      dependencies.recordEvent({ ...request, outcome: "denied" });
      return { status: "error", message: deniedMessage };
    }
    const actor = { ...request, actorAdminUserId: access.adminUserId };
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      dependencies.recordEvent({ ...actor, outcome: "validation_failed" });
      return {
        status: "error",
        message: "対象の教会と利用者を確認してください。",
      };
    }
    const { churchId, userId } = parsed.data;
    const event = { ...actor, targetChurchId: churchId, targetUserId: userId };
    try {
      await dependencies.resendInvitation(access.adminUserId, churchId, userId);
      dependencies.recordEvent({ ...event, outcome: "succeeded" });
      return {
        status: "success",
        message:
          "招待メールを再送しました。新しいリンクの有効期限は3日間です。",
      };
    } catch (error) {
      const denied = error instanceof InvitationResendAuthorizationError;
      const limited = error instanceof InvitationResendRateLimitError;
      dependencies.recordEvent({
        ...event,
        outcome: denied ? "denied" : limited ? "rate_limited" : "failed",
      });
      return {
        status: "error",
        message: denied
          ? deniedMessage
          : limited
            ? "続けて再送できません。1分ほど待ってからお試しください。"
            : error instanceof InvitationResendUnavailableError
              ? "再送できる招待が見つかりません。教会と利用者の状態を確認してください。"
              : "招待メールを再送できませんでした。時間をおいてもう一度お試しください。",
      };
    }
  };
}
