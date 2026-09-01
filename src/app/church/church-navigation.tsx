import Link from "next/link";

export function ChurchNavigation() {
  return (
    <nav className="church-navigation" aria-label="主要ナビゲーション">
      <Link href="/scripture">聖書検索</Link>
      <Link href="/slides">スライド</Link>
    </nav>
  );
}
