"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import type { DeleteChurchState } from "@/application/admin/delete-church-controller";

export function DeleteChurchButton({
  action,
  churchId,
  churchName,
}: {
  action: (
    state: DeleteChurchState,
    formData: FormData,
  ) => Promise<DeleteChurchState>;
  churchId: string;
  churchName: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const [confirmationName, setConfirmationName] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const descriptionId = useId();
  const headingId = useId();
  const inputId = useId();
  const feedback = useRef<HTMLParagraphElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) input.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (state.status === "error") feedback.current?.focus();
  }, [state]);

  return (
    <div className="admin-church-delete">
      <button
        aria-label={`${churchName}を削除`}
        className="admin-church-action-control admin-delete-button"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        削除
      </button>
      {isOpen ? (
        <div
          aria-describedby={descriptionId}
          aria-labelledby={headingId}
          aria-modal="true"
          className="admin-delete-dialog-backdrop"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !pending) setIsOpen(false);
          }}
          role="dialog"
        >
          <section className="admin-delete-dialog">
            <h2 id={headingId}>教会を削除</h2>
            <p id={descriptionId}>
              <strong>{churchName}</strong>
              のフォルダー、お気に入り、所属利用者、ログイン情報、セッションをすべて物理削除します。この操作は取り消せません。
            </p>
            <form action={formAction}>
              <input name="churchId" type="hidden" value={churchId} />
              <label htmlFor={inputId}>
                確認のため「{churchName}」と入力してください
              </label>
              <input
                autoComplete="off"
                id={inputId}
                name="confirmationName"
                onChange={(event) => setConfirmationName(event.target.value)}
                ref={input}
                required
                type="text"
                value={confirmationName}
              />
              <div className="admin-delete-dialog-actions">
                <button
                  className="secondary-button"
                  disabled={pending}
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  キャンセル
                </button>
                <button
                  className="admin-delete-button"
                  disabled={pending || confirmationName.trim() !== churchName}
                  type="submit"
                >
                  {pending ? "削除中…" : "教会を完全に削除"}
                </button>
              </div>
            </form>
            {state.status === "error" ? (
              <p
                className="admin-church-delete-error"
                ref={feedback}
                role="alert"
                tabIndex={-1}
              >
                {state.message}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
