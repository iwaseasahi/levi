"use server";

import { headers } from "next/headers";
import {
  createResendChurchUserInvitationController,
  type ResendInvitationState,
} from "@/application/admin/resend-church-user-invitation-controller";
import { resendChurchUserInvitation } from "@/infrastructure/auth/church-user-invitation-resend";
import { getOperatorAccess } from "@/infrastructure/auth/operator-session";
import { writeLog } from "@/infrastructure/observability/logger";
import { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

const handle = createResendChurchUserInvitationController({
  getOperatorAccess,
  resendInvitation: resendChurchUserInvitation,
  recordEvent({ requestId, ...attributes }) {
    writeLog({
      attributes: {
        capability: "church.user.invitation.resend",
        ...attributes,
      },
      event: "admin.church_user_invitation_resend",
      level: attributes.outcome === "failed" ? "error" : "info",
      ...(requestId ? { requestId } : {}),
    });
  },
});

export async function resendChurchUserInvitationAction(
  _state: ResendInvitationState,
  form: FormData,
): Promise<ResendInvitationState> {
  const requestHeaders = await headers();
  return handle(
    requestHeaders,
    {
      churchId: form.get("churchId"),
      userId: form.get("userId"),
    },
    requestHeaders.get(REQUEST_ID_HEADER) ?? undefined,
  );
}
