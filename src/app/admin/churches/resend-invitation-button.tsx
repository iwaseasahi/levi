"use client";

import { useActionState } from "react";
import type { ResendInvitationState } from "@/application/admin/resend-church-user-invitation-controller";

export function ResendInvitationButton({
  churchId,
  user,
  action,
}: {
  churchId: string;
  user: { id: string; name: string; email: string };
  action(
    state: ResendInvitationState,
    form: FormData,
  ): Promise<ResendInvitationState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  return (
    <form action={formAction} className="admin-resend-invitation">
      <input name="churchId" type="hidden" value={churchId} />
      <input name="userId" type="hidden" value={user.id} />
      <button
        aria-label={`${user.name}（${user.email}）へ招待メールを再送`}
        className="admin-church-action-control secondary-button"
        disabled={pending}
        type="submit"
      >
        {pending ? "送信中…" : "招待メールを再送"}
      </button>
      {state.status !== "idle" ? (
        <p role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
