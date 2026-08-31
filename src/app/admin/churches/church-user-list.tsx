"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { DeleteChurchUserState } from "@/application/admin/delete-church-user-controller";
import type { ChurchDirectoryEntry } from "@/infrastructure/database/church-directory";

type ChurchUser = ChurchDirectoryEntry["users"][number];
const statusLabels = { ACTIVE: "有効", PENDING: "招待中" } as const;

export function ChurchUserList({
  churchId,
  churchName,
  users,
  deleteAction,
}: {
  churchId: string;
  churchName: string;
  users: ChurchUser[];
  deleteAction(
    state: DeleteChurchUserState,
    formData: FormData,
  ): Promise<DeleteChurchUserState>;
}) {
  const [state, formAction, pending] = useActionState(deleteAction, {
    status: "idle",
  });
  const [selected, setSelected] = useState<ChurchUser | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const id = useId();

  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);

  useEffect(() => {
    if (state.status === "success") dialog.current?.close();
    if (state.status === "error") feedback.current?.focus();
  }, [state]);

  return (
    <div aria-label={`${churchName}の利用者`} ref={container} tabIndex={-1}>
      {users.length === 0 ? (
        <p className="admin-church-no-user">利用者は未登録です。</p>
      ) : (
        <ul className="admin-church-users">
          {users.map((user) => (
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
                  <dd className="admin-church-user-actions">
                    <span
                      className={`status-badge status-${user.status.toLowerCase()}`}
                    >
                      {statusLabels[user.status]}
                    </span>
                    <button
                      aria-label={`${user.name}（${user.email}）を削除`}
                      className="admin-church-action-control admin-delete-button"
                      onClick={(event) => {
                        trigger.current = event.currentTarget;
                        setConfirmation("");
                        setShowFeedback(false);
                        setSelected(user);
                      }}
                      type="button"
                    >
                      削除
                    </button>
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
      {state.status === "success" && !selected ? (
        <p role="status">{state.message}</p>
      ) : null}
      <dialog
        aria-describedby={`${id}-description`}
        aria-labelledby={`${id}-heading`}
        className="admin-delete-dialog admin-church-user-dialog"
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            'input:not([type="hidden"]):not(:disabled), button:not(:disabled)',
          );
          const first = controls.item(0);
          const last = controls.item(controls.length - 1);
          if (!first || !last) return;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        onClose={() => {
          setSelected(null);
          if (trigger.current?.isConnected) trigger.current.focus();
          else container.current?.focus();
        }}
        ref={dialog}
      >
        {selected ? (
          <>
            <h2 id={`${id}-heading`}>利用者を削除</h2>
            <p id={`${id}-description`}>
              {churchName}の利用者「{selected.name}」（{selected.email}
              ）と、そのログイン情報・全セッション・招待／再設定リンクを削除します。
              教会、共有フォルダー、お気に入り、他の利用者は残ります。最後の利用者を削除しても教会は残ります。この操作は取り消せません。
            </p>
            <form action={formAction} onSubmit={() => setShowFeedback(true)}>
              <input name="churchId" type="hidden" value={churchId} />
              <input name="userId" type="hidden" value={selected.id} />
              <label htmlFor={`${id}-email`}>
                確認のため利用者のメールアドレスを入力してください
              </label>
              <input
                autoComplete="off"
                disabled={pending}
                id={`${id}-email`}
                name="confirmationEmail"
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type="text"
                inputMode="email"
                value={confirmation}
              />
              <div className="admin-delete-dialog-actions">
                <button
                  className="secondary-button"
                  disabled={pending}
                  onClick={() => dialog.current?.close()}
                  type="button"
                >
                  キャンセル
                </button>
                <button
                  className="admin-delete-button"
                  disabled={
                    pending ||
                    confirmation.trim().toLowerCase() !==
                      selected.email.toLowerCase()
                  }
                  type="submit"
                >
                  {pending ? "削除中…" : "利用者を完全に削除"}
                </button>
              </div>
            </form>
            {showFeedback && state.status === "error" ? (
              <p
                className="admin-church-delete-error"
                ref={feedback}
                role="alert"
                tabIndex={-1}
              >
                {state.message}
              </p>
            ) : null}
          </>
        ) : null}
      </dialog>
    </div>
  );
}
