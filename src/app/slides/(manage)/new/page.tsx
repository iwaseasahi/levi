import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import { SlideEditor } from "@/app/slides/slide-editor";

export default async function NewSlidePage() {
  await requireChurchPageAccess();
  return <SlideEditor />;
}
