import Link from "next/link";
import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import { SlideList } from "./slide-list";

export default async function SlidesPage() {
  await requireChurchPageAccess();
  return (
    <>
      <h1>スライド</h1>
      <Link href="/slides/new">スライドを作成</Link>
      <SlideList />
    </>
  );
}
