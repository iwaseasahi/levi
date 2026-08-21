"use server";

import { headers } from "next/headers";

import {
  createProvisionChurchController,
  type ProvisionChurchFormState,
} from "@/application/admin/provision-church-controller";
import { provisionChurch } from "@/application/admin/provision-church";
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
        ...(event.actorUserId ? { actorUserId: event.actorUserId } : {}),
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
