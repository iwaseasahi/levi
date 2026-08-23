import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getChurchAccess } from "@/infrastructure/auth/church-session";

export async function requireChurchPageAccess() {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (access.mustChangePassword) redirect("/change-password");
  return access;
}
