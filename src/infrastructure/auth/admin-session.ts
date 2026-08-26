import { prisma } from "@/infrastructure/database/client";
import { adminAuth } from "./admin-server";

export type AdminSessionAccess =
  | {
      adminUserId: string;
      name: string;
      sessionId: string;
      status: "authorized";
    }
  | { status: "unauthenticated" };

export async function getAdminSessionAccess(
  headers: Headers,
): Promise<AdminSessionAccess> {
  const authSession = await adminAuth.api.getSession({ headers });
  if (!authSession) return { status: "unauthenticated" };

  const adminUser = await prisma.adminUser.findUnique({
    select: { id: true, name: true, status: true },
    where: { id: authSession.user.id },
  });
  if (!adminUser || adminUser.status !== "ACTIVE")
    return { status: "unauthenticated" };

  return {
    adminUserId: adminUser.id,
    name: adminUser.name,
    sessionId: authSession.session.id,
    status: "authorized",
  };
}
