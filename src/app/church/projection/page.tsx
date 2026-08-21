import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  parseScriptureSearch,
  ScriptureSearchError,
} from "@/domain/scripture/search";
import { getChurchAccess } from "@/infrastructure/auth/church-session";

export default async function ProjectionHandoffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (access.mustChangePassword) redirect("/change-password");

  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.append(key, value);
  }
  let selection;
  try {
    selection = parseScriptureSearch(params);
  } catch (error) {
    if (error instanceof ScriptureSearchError) notFound();
    throw error;
  }

  return (
    <main className="shell">
      <section className="card projection-handoff">
        <p className="eyebrow">Projection</p>
        <h1>投影の準備ができました</h1>
        <p>
          {selection.book} {selection.chapter}:{selection.startVerse}–
          {selection.endVerse}（
          {selection.language === "ja"
            ? "日本語"
            : selection.language === "en"
              ? "英語"
              : "日本語と英語"}
          ）
        </p>
        <p>操作画面と会衆向け画面は次の実装段階で接続します。</p>
        <Link href="/church">検索画面へ戻る</Link>
      </section>
    </main>
  );
}
