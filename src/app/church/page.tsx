import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { prisma } from "@/infrastructure/database/client";
import { ScriptureSearch } from "./scripture-search";
export default async function ChurchPage() {
  const access = await getChurchAccess(await headers());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status !== "authorized") notFound();
  if (access.mustChangePassword) redirect("/change-password");
  const church = await prisma.church.findFirst({
    where: { id: access.scope.churchId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!church) notFound();
  return (
    <main className="ginmaku-search-page">
      <ScriptureSearch />
    </main>
  );
}
