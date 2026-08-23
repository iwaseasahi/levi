"use server";

import { headers } from "next/headers";

import {
  createChangePasswordController,
  type ChangePasswordState,
  type PasswordLifecycleAuditEvent,
} from "@/application/auth/password-lifecycle-controller";
import { getForcedPasswordChangeSession } from "@/infrastructure/auth/church-session";
import { completeForcedPasswordChange } from "@/infrastructure/auth/password-lifecycle";
import { writeLog } from "@/infrastructure/observability/logger";
import { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

export type { ChangePasswordState };

function recordEvent(event: PasswordLifecycleAuditEvent) {
  writeLog({
    attributes: {
      capability: "church.password.change",
      outcome: event.outcome,
      ...(event.actorUserId ? { actorUserId: event.actorUserId } : {}),
      ...(event.targetUserId ? { targetUserId: event.targetUserId } : {}),
    },
    event: "church.password_change",
    level: event.outcome === "failed" ? "error" : "info",
    ...(event.requestId ? { requestId: event.requestId } : {}),
  });
}

const changePassword = createChangePasswordController({
  completeForcedPasswordChange,
  getForcedPasswordChangeSession,
  recordEvent,
});

export async function changePasswordAction(
  _state: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const requestHeaders = await headers();
  return changePassword(
    requestHeaders,
    {
      confirmation: formData.get("confirmation"),
      newPassword: formData.get("newPassword"),
    },
    requestHeaders.get(REQUEST_ID_HEADER) ?? undefined,
  );
}
