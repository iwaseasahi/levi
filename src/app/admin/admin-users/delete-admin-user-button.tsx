"use client";

import { useActionState, useEffect, useRef } from "react";

import type { DeleteAdminUserState } from "@/application/admin/delete-admin-user-controller";

export function DeleteAdminUserButton({
  action,
  adminUserId,
  adminUserName,
}: {
  action: (
    state: DeleteAdminUserState,
    formData: FormData,
  ) => Promise<DeleteAdminUserState>;
  adminUserId: string;
  adminUserName: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const feedback = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status === "error") feedback.current?.focus();
  }, [state]);

  return (
    <div className="admin-user-delete">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `${adminUserName} を削除します。管理者セッションもすべて失効します。よろしいですか？`,
            )
          )
            event.preventDefault();
        }}
      >
        <input name="adminUserId" type="hidden" value={adminUserId} />
        <button
          className="admin-delete-button"
          disabled={pending}
          type="submit"
        >
          {pending ? "削除中…" : "削除"}
        </button>
      </form>
      {state.status === "error" ? (
        <p
          className="admin-user-delete-error"
          ref={feedback}
          role="alert"
          tabIndex={-1}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
