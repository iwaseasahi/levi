import Link from "next/link";
import { listAdminUsers } from "@/infrastructure/auth/admin-user-invitations";
import { AdminUserList } from "./admin-user-list";
import { requireAdminPageAccess } from "@/infrastructure/auth/admin-page-access";

export default async function AdminUsersPage() {
  await requireAdminPageAccess();
  const adminUsers = await listAdminUsers();
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">運営管理</p>
        <h1>管理者の一覧</h1>
        <p>登録されている管理者IDと現在の状態を確認できます。</p>
        <Link
          className="primary-button admin-header-action"
          href="/admin/admin-users/new"
        >
          管理者を招待
        </Link>
      </header>
      <AdminUserList adminUsers={adminUsers} />
    </main>
  );
}
