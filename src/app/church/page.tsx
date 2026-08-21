import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { prisma } from "@/infrastructure/database/client";
import { LogoutButton } from "./logout-button";
import { ScriptureSearch } from "./scripture-search";
export default async function ChurchPage() {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (access.mustChangePassword) redirect("/change-password");
  const church = await prisma.church.findFirst({
    where: { id: access.churchId, status: "ACTIVE" },
    select: { name: true },
  });
  if (!church) notFound();
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">教会用画面</p>
        <h1>{church.name}</h1>
        <p>御言葉を検索し、会衆へ投影する内容を準備します。</p>
        <LogoutButton />
      </header>
      <ScriptureSearch />
    </main>
  );
}
