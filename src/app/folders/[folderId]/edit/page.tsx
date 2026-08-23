import { FolderEditPanel } from "@/app/church/folder-edit-panel";
import { requireChurchPageAccess } from "@/app/church/require-church-page-access";

export default async function FolderEditPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  await requireChurchPageAccess();
  const { folderId } = await params;
  return <FolderEditPanel folderId={folderId} />;
}
