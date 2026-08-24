import { listAdminUsers } from "@/infrastructure/auth/admin-user-invitations";
import { inviteAdminUserAction } from "./actions";
import { InviteAdminUserForm } from "./invite-admin-user-form";

const statusLabels = {
  ACTIVE: "有効",
  BOOTSTRAP: "Basic認証",
  INVITED: "招待済み（ログイン未対応）",
  SUSPENDED: "停止中",
} as const;

export default async function AdminUsersPage() {
  const adminUsers = await listAdminUsers();
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">運営管理</p>
        <h1>管理者</h1>
        <p>管理者IDの確認と招待を行います。</p>
      </header>
      <InviteAdminUserForm action={inviteAdminUserAction} />
      <section
        className="admin-form admin-user-list"
        aria-labelledby="admin-users-heading"
      >
        <h2 id="admin-users-heading">管理者ID</h2>
        <ul>
          {adminUsers.map((adminUser) => (
            <li key={adminUser.id}>
              <div>
                <strong>{adminUser.name}</strong>
                <span>{adminUser.loginId}</span>
              </div>
              <span
                className={`status-badge status-${adminUser.status.toLowerCase()}`}
              >
                {statusLabels[adminUser.status]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
