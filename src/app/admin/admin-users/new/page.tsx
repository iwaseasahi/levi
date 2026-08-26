import Link from "next/link";
import { inviteAdminUserAction } from "../actions";
import { InviteAdminUserForm } from "../invite-admin-user-form";
import { requireAdminPageAccess } from "@/infrastructure/auth/admin-page-access";

export default async function InviteAdminUserPage() {
  await requireAdminPageAccess();
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">運営管理</p>
        <h1>管理者を招待</h1>
        <p>新しい管理者IDと初回ログイン用の一時パスワードを発行します。</p>
        <Link className="admin-back-link" href="/admin/admin-users">
          ← 管理者の一覧へ
        </Link>
      </header>
      <InviteAdminUserForm action={inviteAdminUserAction} />
    </main>
  );
}
