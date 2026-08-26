import { headers } from "next/headers";
import { getAdminSessionAccess } from "@/infrastructure/auth/admin-session";

import { AdminSidebar } from "./admin-sidebar";

export default async function AdministrationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await getAdminSessionAccess(await headers());
  if (access.status !== "authorized" || access.mustChangePassword)
    return children;

  return (
    <div className="admin-workspace">
      <AdminSidebar />
      <div className="admin-content">{children}</div>
    </div>
  );
}
