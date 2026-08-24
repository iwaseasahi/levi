import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getOperatorAccess } from "@/infrastructure/auth/operator-session";
import { AdminSidebar } from "./admin-sidebar";

export default async function AdministrationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await getOperatorAccess(await headers());
  if (access.status !== "authorized") notFound();

  return (
    <div className="admin-workspace">
      <AdminSidebar />
      <div className="admin-content">{children}</div>
    </div>
  );
}
