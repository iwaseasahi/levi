import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { FolderListPanel } from "@/app/church/folder-list-panel";
import { getChurchAccess } from "@/infrastructure/auth/church-session";

export default async function FolderListPage() {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (access.mustChangePassword) redirect("/change-password");
  return <FolderListPanel />;
}
