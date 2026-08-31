import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import { SlideDocument } from "../slide-document";

export default async function SlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireChurchPageAccess();
  const { id } = await params;
  return <SlideDocument key={id} id={id} />;
}
