"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { authenticateAdminBasic } from "@/infrastructure/auth/admin-basic-auth";
import { getAdminSessionAccess } from "@/infrastructure/auth/admin-session";
import { prisma } from "@/infrastructure/database/client";
import { writeLog } from "@/infrastructure/observability/logger";
import { REQUEST_ID_HEADER } from "@/infrastructure/observability/request-context";

const ADMIN_SESSION_COOKIE_NAMES = [
  "levi-admin-auth.session_token",
  "__Secure-levi-admin-auth.session_token",
] as const;

export async function adminLogoutAction() {
  const requestHeaders = await headers();
  const basic = await authenticateAdminBasic(
    requestHeaders.get("authorization"),
  );
  const session = await getAdminSessionAccess(requestHeaders);
  if (basic.status === "authorized" && session.status === "authorized") {
    await prisma.adminSession.deleteMany({ where: { id: session.sessionId } });
  }
  const cookieStore = await cookies();
  for (const name of ADMIN_SESSION_COOKIE_NAMES) cookieStore.delete(name);
  const requestId = requestHeaders.get(REQUEST_ID_HEADER);
  writeLog({
    attributes: {
      capability: "admin.logout",
      outcome: basic.status === "authorized" ? "succeeded" : "denied",
      ...(session.status === "authorized"
        ? { actorAdminUserId: session.adminUserId }
        : {}),
    },
    event: "admin.logout",
    level: "info",
    ...(requestId ? { requestId } : {}),
  });
  redirect("/admin/login");
}
