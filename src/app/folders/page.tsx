import { FolderListPanel } from "@/app/church/folder-list-panel";
import { requireChurchPageAccess } from "@/app/church/require-church-page-access";

export default async function FolderListPage() {
  await requireChurchPageAccess();
  return <FolderListPanel />;
}
