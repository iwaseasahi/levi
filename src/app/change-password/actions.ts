"use server";
import { headers } from "next/headers";
import {
  completeForcedPasswordChange,
  PasswordLifecycleAuthorizationError,
  PasswordLifecycleInputError,
} from "@/application/auth/password-lifecycle";
import { getForcedPasswordChangeSession } from "@/infrastructure/auth/church-session";

export type ChangePasswordState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };
export async function changePasswordAction(
  _state: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await getForcedPasswordChangeSession(await headers());
  if (!session)
    return {
      status: "error",
      message: "この操作を実行できません。再度ログインしてください。",
    };
  try {
    await completeForcedPasswordChange({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmation: formData.get("confirmation"),
      ...session,
    });
    return {
      status: "success",
      message: "パスワードを変更しました。他のセッションはすべて失効しました。",
    };
  } catch (error) {
    if (error instanceof PasswordLifecycleInputError)
      return {
        status: "error",
        message: "12〜128文字の新しいパスワードを一致させて入力してください。",
      };
    return {
      status: "error",
      message:
        error instanceof PasswordLifecycleAuthorizationError
          ? "セッションが無効です。再度ログインしてください。"
          : "変更できませんでした。現在のパスワードを確認してください。",
    };
  }
}
