import type { Metadata } from "next";
import Link from "next/link";
import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import { SlideList } from "@/app/slides/slide-list";

export const metadata: Metadata = { title: "スライドの一覧" };

export default async function SlidesPage() {
  await requireChurchPageAccess();
  return (
    <>
      <header className="slide-list-header">
        <h1>スライドの一覧</h1>
        <Link className="slide-create-link" href="/slides/new">
          スライドを作成
        </Link>
      </header>
      <SlideList />
    </>
  );
}
