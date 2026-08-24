import Link from "next/link";
import { inviteAdminUserAction } from "../actions";
import { InviteAdminUserForm } from "../invite-admin-user-form";

export default function InviteAdminUserPage() {
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">運営管理</p>
        <h1>管理者を招待</h1>
        <p>
          新しい管理者IDを発行します。個別ログインは後続対応で有効になります。
        </p>
        <Link className="admin-back-link" href="/admin/admin-users">
          ← 管理者の一覧へ
        </Link>
      </header>
      <InviteAdminUserForm action={inviteAdminUserAction} />
    </main>
  );
}
