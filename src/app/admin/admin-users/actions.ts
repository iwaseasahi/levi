"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  createInviteAdminUserController,
  type InviteAdminUserFormState,
} from "@/application/admin/invite-admin-user-controller";
import {
  createDeleteAdminUserController,
  type DeleteAdminUserState,
} from "@/application/admin/delete-admin-user-controller";
import { deleteAdminUser } from "@/infrastructure/auth/admin-user-deletion";
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

const handleDelete = createDeleteAdminUserController({
  deleteAdminUser,
  getOperatorAccess,
  recordEvent(event) {
    writeLog({
      attributes: {
        capability: "admin.delete",
        outcome: event.outcome,
        ...(event.actorAdminUserId && {
          actorAdminUserId: event.actorAdminUserId,
        }),
        ...(event.targetAdminUserId && {
          targetAdminUserId: event.targetAdminUserId,
        }),
      },
      event: "admin.user_deletion",
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
    {
      email: formData.get("email"),
      loginId: formData.get("loginId"),
      name: formData.get("name"),
    },
    requestHeaders.get(REQUEST_ID_HEADER) ?? undefined,
  );
  if (result.status === "success") revalidatePath("/admin/admin-users");
  return result;
}

export async function deleteAdminUserAction(
  _previousState: DeleteAdminUserState,
  formData: FormData,
): Promise<DeleteAdminUserState> {
  const requestHeaders = await headers();
  const result = await handleDelete(
    requestHeaders,
    formData.get("adminUserId"),
    requestHeaders.get(REQUEST_ID_HEADER) ?? undefined,
  );
  if (result.status === "success") revalidatePath("/admin/admin-users");
  return result;
}
