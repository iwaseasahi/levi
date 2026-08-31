import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import { SlideDetailWorkspace } from "@/app/slides/slide-detail-workspace";

export default async function SlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireChurchPageAccess();
  const { id } = await params;
  return <SlideDetailWorkspace key={id} id={id} />;
}
