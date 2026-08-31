import Link from "next/link";
import type { ReactNode } from "react";

export default function SlideLayout({ children }: { children: ReactNode }) {
  return (
    <main className="slide-page">
      <nav aria-label="スライドナビゲーション">
        <Link href="/scripture">聖書検索</Link>
        <Link href="/slides">スライド</Link>
      </nav>
      {children}
    </main>
  );
}
