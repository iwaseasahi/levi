"use server";

import { headers } from "next/headers";

import {
  createResetPasswordController,
  type PasswordLifecycleAuditEvent,
  type ResetPasswordState,
} from "@/application/auth/password-lifecycle-controller";
import { getOperatorAccess } from "@/infrastructure/auth/operator-session";
import { resetChurchPassword } from "@/infrastructure/auth/password-lifecycle";
import { writeLog } from "@/infrastructure/observability/logger";
import { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

export type { ResetPasswordState };

function recordEvent(event: PasswordLifecycleAuditEvent) {
  writeLog({
    attributes: {
      capability: "church.password.reset",
      outcome: event.outcome,
      ...(event.actorUserId ? { actorUserId: event.actorUserId } : {}),
      ...(event.targetChurchId ? { targetChurchId: event.targetChurchId } : {}),
      ...(event.targetUserId ? { targetUserId: event.targetUserId } : {}),
    },
    event: "admin.church_password_reset",
    level: event.outcome === "failed" ? "error" : "info",
    ...(event.requestId ? { requestId: event.requestId } : {}),
  });
}

const resetPassword = createResetPasswordController({
  getOperatorAccess,
  recordEvent,
  resetChurchPassword,
});

export async function resetPasswordAction(
  _state: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const requestHeaders = await headers();
  return resetPassword(
    requestHeaders,
    {
      churchId: formData.get("churchId"),
      confirmed: formData.get("confirmed"),
    },
    requestHeaders.get(REQUEST_ID_HEADER) ?? undefined,
  );
}
