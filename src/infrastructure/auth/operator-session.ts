import type { OperatorAccess } from "@/application/auth/operator-access";
import { authenticateAdminBasic } from "./admin-basic-auth";

export async function getOperatorAccess(
  headers: Headers,
): Promise<OperatorAccess> {
  const access = await authenticateAdminBasic(headers.get("authorization"));
  return access.status === "authorized"
    ? { status: "authorized", userId: access.userId }
    : { status: "unauthenticated" };
}
