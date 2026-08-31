import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import { SlideDocument } from "@/app/slides/slide-document";
import { SlideManageShell } from "@/app/slides/slide-manage-shell";

export default async function EditSlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireChurchPageAccess();
  const { id } = await params;
  return (
    <SlideManageShell>
      <SlideDocument key={id} id={id} editing />
    </SlideManageShell>
  );
}
