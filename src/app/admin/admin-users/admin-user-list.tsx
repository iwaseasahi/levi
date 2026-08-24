import type { AdminUserSummary } from "@/infrastructure/auth/admin-user-invitations";

const statusLabels = {
  ACTIVE: "有効",
  BOOTSTRAP: "Basic認証",
  INVITED: "招待済み（ログイン未対応）",
  SUSPENDED: "停止中",
} as const;

export function AdminUserList({
  adminUsers,
}: {
  adminUsers: AdminUserSummary[];
}) {
  return (
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
  );
}
