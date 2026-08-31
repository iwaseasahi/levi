import type { Metadata } from "next";
import Link from "next/link";
import { requireChurchPageAccess } from "@/app/church/require-church-page-access";
import { SlideList } from "@/app/slides/slide-list";
import { SlideNavigation } from "@/app/slides/slide-navigation";
import { SlideSidebar } from "@/app/slides/slide-sidebar";

export const metadata: Metadata = { title: "スライドの一覧" };

export default async function SlidesPage() {
  await requireChurchPageAccess();
  return (
    <div className="slide-index-workspace">
      <SlideSidebar />
      <main className="slide-page">
        <SlideNavigation />
        <header className="slide-list-header">
          <h1>スライドの一覧</h1>
          <Link className="slide-create-link" href="/slides/new">
            スライドを作成
          </Link>
        </header>
        <SlideList />
      </main>
    </div>
  );
}
