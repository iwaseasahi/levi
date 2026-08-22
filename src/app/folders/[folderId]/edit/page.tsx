import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { FolderEditPanel } from "@/app/church/folder-edit-panel";
import { getChurchAccess } from "@/infrastructure/auth/church-session";

export default async function FolderEditPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (access.mustChangePassword) redirect("/change-password");
  const { folderId } = await params;
  return <FolderEditPanel folderId={folderId} />;
}
