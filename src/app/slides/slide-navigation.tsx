import Link from "next/link";

export function SlideNavigation() {
  return (
    <nav aria-label="スライドナビゲーション">
      <Link href="/scripture">聖書検索</Link>
      <Link href="/slides">スライド</Link>
    </nav>
  );
}
