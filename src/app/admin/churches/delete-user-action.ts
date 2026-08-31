"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createDeleteChurchUserController,
  type DeleteChurchUserState,
} from "@/application/admin/delete-church-user-controller";
import { deleteChurchUser } from "@/infrastructure/auth/church-user-deletion";
import { getOperatorAccess } from "@/infrastructure/auth/operator-session";
import { writeLog } from "@/infrastructure/observability/logger";
import { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

const handleDeleteChurchUser = createDeleteChurchUserController({
  deleteChurchUser,
  getOperatorAccess,
  recordEvent({ requestId, ...attributes }) {
    writeLog({
      attributes: { capability: "church.user.delete", ...attributes },
      event: "admin.church_user_deletion",
      level: attributes.outcome === "failed" ? "error" : "info",
      ...(requestId ? { requestId } : {}),
    });
  },
});

export async function deleteChurchUserAction(
  _previousState: DeleteChurchUserState,
  formData: FormData,
): Promise<DeleteChurchUserState> {
  const requestHeaders = await headers();
  const result = await handleDeleteChurchUser(
    requestHeaders,
    {
      churchId: formData.get("churchId"),
      userId: formData.get("userId"),
      confirmationEmail: formData.get("confirmationEmail"),
    },
    requestHeaders.get(REQUEST_ID_HEADER) ?? undefined,
  );
  if (result.status === "success") revalidatePath("/admin/churches");
  return result;
}
