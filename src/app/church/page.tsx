import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { prisma } from "@/infrastructure/database/client";
import { LogoutButton } from "./logout-button";
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
        <p>御言葉の検索機能は次の実装段階で追加します。</p>
      </header>
      <LogoutButton />
    </main>
  );
}
