import type { OperatorAccess } from "@/application/auth/operator-access";
import { authenticateAdminBasic } from "./admin-basic-auth";
import { getAdminSessionAccess } from "./admin-session";

export async function getOperatorAccess(
  headers: Headers,
): Promise<OperatorAccess> {
  const access = await authenticateAdminBasic(headers.get("authorization"));
  if (access.status !== "authorized") return { status: "unauthenticated" };
  const session = await getAdminSessionAccess(headers);
  if (session.status !== "authorized") return { status: "unauthenticated" };
  return session.mustChangePassword
    ? { status: "forbidden", adminUserId: session.adminUserId }
    : { status: "authorized", adminUserId: session.adminUserId };
}
