import Link from "next/link";

import type { DeleteChurchState } from "@/application/admin/delete-church-controller";
import type { ChurchDirectoryEntry } from "@/infrastructure/database/church-directory";
import { DeleteChurchButton } from "./delete-church-button";
import { ChurchUserList } from "./church-user-list";
import type { DeleteChurchUserState } from "@/application/admin/delete-church-user-controller";

const churchStatusLabels = {
  ACTIVE: "利用中",
  SUSPENDED: "停止中",
} as const;

export function ChurchList({
  churches,
  deleteAction,
  deleteUserAction,
}: {
  churches: ChurchDirectoryEntry[];
  deleteAction: (
    state: DeleteChurchState,
    formData: FormData,
  ) => Promise<DeleteChurchState>;
  deleteUserAction: (
    state: DeleteChurchUserState,
    formData: FormData,
  ) => Promise<DeleteChurchUserState>;
}) {
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
                  <DeleteChurchButton
                    action={deleteAction}
                    churchId={church.id}
                    churchName={church.name}
                  />
                </div>
              </div>
              <ChurchUserList
                churchId={church.id}
                churchName={church.name}
                users={church.users}
                deleteAction={deleteUserAction}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
