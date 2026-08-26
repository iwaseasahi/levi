"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
} from "@/domain/admin/admin-session";
import { authenticateAdminBasic } from "@/infrastructure/auth/admin-basic-auth";
import {
  changeAdminPassword,
  getAdminSessionAccess,
  loginAdminUser,
  logoutAdminSession,
} from "@/infrastructure/auth/admin-session";
import { writeLog } from "@/infrastructure/observability/logger";
import { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

export type AdminLoginState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "success";
      destination: "/admin" | "/admin/change-password";
    };

export type AdminPasswordState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

function audit(
  event: string,
  capability: string,
  outcome: "denied" | "failed" | "succeeded" | "validation_failed",
  requestId?: string | null,
  actorAdminUserId?: string,
) {
  writeLog({
    attributes: {
      capability,
      outcome,
      ...(actorAdminUserId ? { actorAdminUserId } : {}),
    },
    event,
    level: outcome === "failed" ? "error" : "info",
    ...(requestId ? { requestId } : {}),
  });
}

export async function adminLoginAction(
  _state: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const requestHeaders = await headers();
  const requestId = requestHeaders.get(REQUEST_ID_HEADER);
  const basic = await authenticateAdminBasic(
    requestHeaders.get("authorization"),
  );
  if (basic.status !== "authorized") {
    audit("admin.login", "admin.login", "denied", requestId);
    return { status: "error", message: "ログインできませんでした。" };
  }
  const result = await loginAdminUser(
    formData.get("loginId"),
    formData.get("password"),
  );
  if (result.status !== "success") {
    audit(
      "admin.login",
      "admin.login",
      result.status === "unavailable" ? "failed" : "denied",
      requestId,
    );
    return {
      status: "error",
      message:
        result.status === "rate-limited"
          ? "試行回数が多すぎます。1分後にお試しください。"
          : "ログインIDまたはパスワードを確認してください。",
    };
  }
  (await cookies()).set(ADMIN_SESSION_COOKIE, result.token, {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/admin",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  audit("admin.login", "admin.login", "succeeded", requestId);
  return {
    destination: result.mustChangePassword
      ? "/admin/change-password"
      : "/admin",
    status: "success",
  };
}

export async function adminChangePasswordAction(
  _state: AdminPasswordState,
  formData: FormData,
): Promise<AdminPasswordState> {
  const requestHeaders = await headers();
  const requestId = requestHeaders.get(REQUEST_ID_HEADER);
  const basic = await authenticateAdminBasic(
    requestHeaders.get("authorization"),
  );
  const session = await getAdminSessionAccess(requestHeaders);
  if (
    basic.status !== "authorized" ||
    session.status !== "authorized" ||
    !session.mustChangePassword
  ) {
    audit(
      "admin.password_change",
      "admin.password.change",
      "denied",
      requestId,
    );
    return { status: "error", message: "再度ログインしてください。" };
  }
  const result = await changeAdminPassword({
    adminUserId: session.adminUserId,
    confirmation: formData.get("confirmation"),
    newPassword: formData.get("newPassword"),
    sessionId: session.sessionId,
  });
  audit(
    "admin.password_change",
    "admin.password.change",
    result.status === "success"
      ? "succeeded"
      : result.status === "invalid"
        ? "validation_failed"
        : "denied",
    requestId,
    session.adminUserId,
  );
  return result.status === "success"
    ? { status: "success" }
    : {
        status: "error",
        message:
          result.status === "invalid"
            ? "12〜128文字の新しいパスワードを一致させて入力してください。"
            : "セッションが無効です。再度ログインしてください。",
      };
}

export async function adminLogoutAction() {
  const requestHeaders = await headers();
  const basic = await authenticateAdminBasic(
    requestHeaders.get("authorization"),
  );
  const session = await getAdminSessionAccess(requestHeaders);
  if (basic.status === "authorized") {
    await logoutAdminSession(requestHeaders);
  }
  (await cookies()).delete(ADMIN_SESSION_COOKIE);
  audit(
    "admin.logout",
    "admin.logout",
    basic.status === "authorized" ? "succeeded" : "denied",
    requestHeaders.get(REQUEST_ID_HEADER),
    session.status === "authorized" ? session.adminUserId : undefined,
  );
  redirect("/admin/login");
}
