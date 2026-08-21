import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getOperatorAccess } from "@/infrastructure/auth/operator-session";
import { provisionChurchAction } from "./actions";
import { ProvisionChurchForm } from "./provision-church-form";
import { prisma } from "@/infrastructure/database/client";
import { resetPasswordAction } from "./reset-actions";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ChurchAdministrationPage() {
  const access = await getOperatorAccess(await headers());

  if (access.status === "unauthenticated") {
    redirect("/login");
  }
  if (access.status !== "authorized") {
    notFound();
  }
  const churches = await prisma.church.findMany({
    where: { status: "ACTIVE", membership: { isNot: null } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">Levi 運営者</p>
        <h1>教会アカウントを作成</h1>
        <p>
          教会と最初の利用者を同時に作成します。一時パスワードは作成直後に
          一度だけ表示されます。
        </p>
      </header>
      <ProvisionChurchForm action={provisionChurchAction} />
      <ResetPasswordForm action={resetPasswordAction} churches={churches} />
    </main>
  );
}
