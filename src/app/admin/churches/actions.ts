"use server";

import { headers } from "next/headers";

import {
  createProvisionChurchController,
  type ProvisionChurchFormState,
} from "@/application/admin/provision-church-controller";
import {
  createInviteChurchUserController,
  type InviteChurchUserFormState,
} from "@/application/admin/invite-church-user-controller";
import { inviteChurchUser } from "@/infrastructure/auth/church-user-invitations";
import { provisionChurch } from "@/infrastructure/auth/church-provisioning";
import { getOperatorAccess } from "@/infrastructure/auth/operator-session";
import { writeLog } from "@/infrastructure/observability/logger";
import { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

const handleProvisionChurch = createProvisionChurchController({
  getOperatorAccess,
  provisionChurch,
  recordEvent(event) {
    writeLog({
      attributes: {
        capability: "church.provision",
        outcome: event.outcome,
        ...(event.actorAdminUserId
          ? { actorAdminUserId: event.actorAdminUserId }
          : {}),
        ...(event.targetChurchId
          ? { targetChurchId: event.targetChurchId }
          : {}),
      },
      event: "admin.church_provisioning",
      level: event.outcome === "failed" ? "error" : "info",
      ...(event.requestId ? { requestId: event.requestId } : {}),
    });
  },
});

const handleInviteChurchUser = createInviteChurchUserController({
  getOperatorAccess,
  inviteChurchUser,
  recordEvent(event) {
    writeLog({
      attributes: {
        capability: "church.user.invite",
        outcome: event.outcome,
        ...(event.actorAdminUserId
          ? { actorAdminUserId: event.actorAdminUserId }
          : {}),
        ...(event.targetChurchId
          ? { targetChurchId: event.targetChurchId }
          : {}),
        ...(event.targetUserId ? { targetUserId: event.targetUserId } : {}),
      },
      event: "admin.church_user_invitation",
      level: event.outcome === "failed" ? "error" : "info",
      ...(event.requestId ? { requestId: event.requestId } : {}),
    });
  },
});

export async function provisionChurchAction(
  _previousState: ProvisionChurchFormState,
  formData: FormData,
): Promise<ProvisionChurchFormState> {
  const requestHeaders = await headers();
  return handleProvisionChurch(
    requestHeaders,
    {
      accountName: formData.get("accountName"),
      churchName: formData.get("churchName"),
      email: formData.get("email"),
    },
    requestHeaders.get(REQUEST_ID_HEADER) ?? undefined,
  );
}

export async function inviteChurchUserAction(
  _previousState: InviteChurchUserFormState,
  formData: FormData,
): Promise<InviteChurchUserFormState> {
  const requestHeaders = await headers();
  return handleInviteChurchUser(
    requestHeaders,
    {
      accountName: formData.get("accountName"),
      churchId: formData.get("churchId"),
      email: formData.get("email"),
    },
    requestHeaders.get(REQUEST_ID_HEADER) ?? undefined,
  );
}
