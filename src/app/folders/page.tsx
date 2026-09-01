import { FolderListPanel } from "@/app/church/folder-list-panel";
import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import { ChurchSidebarWorkspace } from "@/app/church/church-sidebar-workspace";

export default async function FolderListPage() {
  await requireChurchPageAccess();
  return (
    <ChurchSidebarWorkspace>
      <FolderListPanel />
    </ChurchSidebarWorkspace>
  );
}
