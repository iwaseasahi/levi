import type { AdminUserSummary } from "@/infrastructure/auth/admin-user-invitations";
import type { DeleteAdminUserState } from "@/application/admin/delete-admin-user-controller";
import { DeleteAdminUserButton } from "./delete-admin-user-button";

const statusLabels = {
  ACTIVE: "有効",
  BOOTSTRAP: "Basic認証",
  INVITED: "初回パスワード変更待ち",
  SUSPENDED: "停止中",
} as const;

export function AdminUserList({
  adminUsers,
  currentAdminUserId,
  deleteAction,
}: {
  adminUsers: AdminUserSummary[];
  currentAdminUserId: string;
  deleteAction: (
    state: DeleteAdminUserState,
    formData: FormData,
  ) => Promise<DeleteAdminUserState>;
}) {
  const visibleAdminUsers = adminUsers.filter(
    (adminUser) => adminUser.status !== "BOOTSTRAP",
  );

  return (
    <section
      className="admin-form admin-user-list"
      aria-labelledby="admin-users-heading"
    >
      <h2 id="admin-users-heading">管理者ID</h2>
      {visibleAdminUsers.length === 0 ? (
        <p className="admin-empty-state">管理者はまだ登録されていません。</p>
      ) : (
        <ul>
          {visibleAdminUsers.map((adminUser) => (
            <li key={adminUser.id}>
              <div>
                <strong>{adminUser.name}</strong>
                <span>{adminUser.loginId}</span>
              </div>
              <div className="admin-user-actions">
                <span
                  className={`status-badge status-${adminUser.status.toLowerCase()}`}
                >
                  {statusLabels[adminUser.status]}
                </span>
                {adminUser.id === currentAdminUserId ? (
                  <span className="current-admin-label">現在の管理者</span>
                ) : (
                  <DeleteAdminUserButton
                    action={deleteAction}
                    adminUserId={adminUser.id}
                    adminUserName={adminUser.name}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
