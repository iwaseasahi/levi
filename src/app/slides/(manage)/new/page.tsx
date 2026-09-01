import { ChurchSidebarWorkspace } from "@/app/church/church-sidebar-workspace";
import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import { SlideEditor } from "@/app/slides/slide-editor";
import { SlideManageShell } from "@/app/slides/slide-manage-shell";

export default async function NewSlidePage() {
  await requireChurchPageAccess();
  return (
    <ChurchSidebarWorkspace>
      <SlideManageShell>
        <SlideEditor />
      </SlideManageShell>
    </ChurchSidebarWorkspace>
  );
}
