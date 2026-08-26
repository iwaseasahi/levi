import { prisma } from "@/infrastructure/database/client";
import { resetPasswordAction } from "../reset-actions";
import { ResetPasswordForm } from "../reset-password-form";
import { requireAdminPageAccess } from "@/infrastructure/auth/admin-page-access";

export default async function ChurchPasswordResetPage() {
  await requireAdminPageAccess();
  const churches = await prisma.church.findMany({
    where: { status: "ACTIVE", membership: { isNot: null } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">教会管理</p>
        <h1>パスワードを再設定</h1>
        <p>
          教会利用者の既存セッションを失効し、新しい一時パスワードを発行します。
        </p>
      </header>
      <ResetPasswordForm action={resetPasswordAction} churches={churches} />
    </main>
  );
}
