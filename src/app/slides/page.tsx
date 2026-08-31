import type { Metadata } from "next";
import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import { SlideIndex } from "@/app/slides/slide-index";

export const metadata: Metadata = { title: "スライドの一覧" };

export default async function SlidesPage() {
  await requireChurchPageAccess();
  return <SlideIndex />;
}
