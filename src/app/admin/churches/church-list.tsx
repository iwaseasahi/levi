import Link from "next/link";

import type { ChurchDirectoryEntry } from "@/infrastructure/database/church-directory";

const churchStatusLabels = {
  ACTIVE: "利用中",
  SUSPENDED: "停止中",
} as const;

const userStatusLabels = {
  ACTIVE: "有効",
  PENDING: "招待中",
} as const;

export function ChurchList({ churches }: { churches: ChurchDirectoryEntry[] }) {
  return (
    <section
      aria-labelledby="churches-heading"
      className="admin-form admin-church-list"
    >
      <h2 id="churches-heading">教会</h2>
      {churches.length === 0 ? (
        <p className="admin-empty-state">教会はまだ登録されていません。</p>
      ) : (
        <ul>
          {churches.map((church) => (
            <li key={church.id}>
              <div className="admin-church-heading">
                <strong>{church.name}</strong>
                <div className="admin-church-actions">
                  <span
                    className={`admin-church-action-control status-badge status-${church.status.toLowerCase()}`}
                  >
                    <span className="visually-hidden">教会の状態: </span>
                    {churchStatusLabels[church.status]}
                  </span>
                  {church.status === "ACTIVE" ? (
                    <Link
                      aria-label={`${church.name}に利用者を招待`}
                      className="admin-church-action-control secondary-button"
                      href={`/admin/churches/${church.id}/users/invite`}
                    >
                      利用者を招待
                    </Link>
                  ) : null}
                </div>
              </div>
              {church.users.length > 0 ? (
                <ul className="admin-church-users">
                  {church.users.map((user) => (
                    <li key={user.id}>
                      <dl>
                        <div>
                          <dt>利用者</dt>
                          <dd>{user.name}</dd>
                        </div>
                        <div>
                          <dt>メールアドレス</dt>
                          <dd>{user.email}</dd>
                        </div>
                        <div>
                          <dt>利用者の状態</dt>
                          <dd>
                            <span
                              className={`status-badge status-${user.status.toLowerCase()}`}
                            >
                              {userStatusLabels[user.status]}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-church-no-user">利用者は未登録です。</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
