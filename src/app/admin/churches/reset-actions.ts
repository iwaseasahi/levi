"use server";

import { headers } from "next/headers";
import { getOperatorAccess } from "@/infrastructure/auth/operator-session";
import { resetChurchPassword } from "@/application/auth/password-lifecycle";
import { writeLog } from "@/infrastructure/observability/logger";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export async function resetPasswordAction(
  _state: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const requestHeaders = await headers();
  const access = await getOperatorAccess(requestHeaders);
  if (access.status !== "authorized")
    return { status: "error", message: "この操作を実行できません。" };
  const churchId = String(formData.get("churchId") ?? "");
  if (formData.get("confirmed") !== "yes")
    return { status: "error", message: "確認欄を選択してください。" };
  try {
    const result = await resetChurchPassword(access.userId, churchId);
    writeLog({
      level: "info",
      event: "admin.church_password_reset",
      attributes: {
        capability: "church.password.reset",
        outcome: "succeeded",
        actorUserId: access.userId,
        targetChurchId: result.churchId,
        targetUserId: result.userId,
      },
    });
    return {
      status: "success",
      churchName: result.churchName,
      email: result.email,
      temporaryPassword: result.temporaryPassword,
      message: "パスワードを再設定し、すべてのセッションを失効しました。",
    };
  } catch {
    const targetChurchId = UUID_PATTERN.test(churchId) ? churchId : undefined;
    writeLog({
      level: "error",
      event: "admin.church_password_reset",
      attributes: {
        capability: "church.password.reset",
        outcome: "failed",
        actorUserId: access.userId,
        ...(targetChurchId ? { targetChurchId } : {}),
      },
    });
    return {
      status: "error",
      message: "再設定できませんでした。対象と状態を確認してください。",
    };
  }
}
