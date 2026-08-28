import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminPageAccess } from "@/infrastructure/auth/admin-page-access";
import { findChurchInvitationTarget } from "@/infrastructure/database/church-directory";
import { inviteChurchUserAction } from "../../../actions";
import { InviteChurchUserForm } from "./invite-church-user-form";

export default async function InviteChurchUserPage({
  params,
}: {
  params: Promise<{ churchId: string }>;
}) {
  await requireAdminPageAccess();
  const { churchId } = await params;
  const church = await findChurchInvitationTarget(churchId);
  if (!church) notFound();

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">教会管理</p>
        <h1>利用者を招待</h1>
        <p>{church.name}へ新しい利用者を招待します。</p>
        <Link className="admin-back-link" href="/admin/churches">
          ← 教会一覧へ
        </Link>
      </header>
      <InviteChurchUserForm
        action={inviteChurchUserAction}
        churchId={church.id}
        churchName={church.name}
      />
    </main>
  );
}
