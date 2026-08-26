import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authenticateAdminBasic } from "./admin-basic-auth";
import { getAdminSessionAccess } from "./admin-session";

export async function requireAdminPageAccess() {
  const requestHeaders = await headers();
  const basic = await authenticateAdminBasic(
    requestHeaders.get("authorization"),
  );
  if (basic.status !== "authorized") redirect("/admin/login");
  const session = await getAdminSessionAccess(requestHeaders);
  if (session.status !== "authorized") redirect("/admin/login");
  return session;
}
