"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  createInviteAdminUserController,
  type InviteAdminUserFormState,
} from "@/application/admin/invite-admin-user-controller";
import { inviteAdminUser } from "@/infrastructure/auth/admin-user-invitations";
import { getOperatorAccess } from "@/infrastructure/auth/operator-session";
import { writeLog } from "@/infrastructure/observability/logger";
import { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

const handleInvite = createInviteAdminUserController({
  getOperatorAccess,
  inviteAdminUser,
  recordEvent(event) {
    writeLog({
      attributes: {
        capability: "admin.invite",
        outcome: event.outcome,
        ...(event.actorAdminUserId && {
          actorAdminUserId: event.actorAdminUserId,
        }),
        ...(event.targetAdminUserId && {
          targetAdminUserId: event.targetAdminUserId,
        }),
      },
      event: "admin.user_invitation",
      level: event.outcome === "failed" ? "error" : "info",
      ...(event.requestId && { requestId: event.requestId }),
    });
  },
});

export async function inviteAdminUserAction(
  _previousState: InviteAdminUserFormState,
  formData: FormData,
): Promise<InviteAdminUserFormState> {
  const requestHeaders = await headers();
  const result = await handleInvite(
    requestHeaders,
    { loginId: formData.get("loginId"), name: formData.get("name") },
    requestHeaders.get(REQUEST_ID_HEADER) ?? undefined,
  );
  if (result.status === "success") revalidatePath("/admin/admin-users");
  return result;
}
