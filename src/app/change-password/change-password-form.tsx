"use client";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ChangePasswordState } from "./actions";

export function ChangePasswordForm({
  action,
}: {
  action: (
    state: ChangePasswordState,
    formData: FormData,
  ) => Promise<ChangePasswordState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  } as ChangePasswordState);
  const feedback = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.status !== "idle") feedback.current?.focus();
  }, [state]);
  return (
    <>
      <form action={formAction} className="auth-form">
        <fieldset disabled={pending}>
          <legend className="sr-only">パスワード変更</legend>
          <label htmlFor="new-password">新しいパスワード</label>
          <input
            autoComplete="new-password"
            id="new-password"
            name="newPassword"
            required
            type="password"
            minLength={12}
            maxLength={128}
          />
          <label htmlFor="confirmation">新しいパスワード（確認）</label>
          <input
            autoComplete="new-password"
            id="confirmation"
            name="confirmation"
            required
            type="password"
            minLength={12}
            maxLength={128}
          />
          <button className="primary-button" type="submit">
            {pending ? "変更中…" : "パスワードを変更"}
          </button>
        </fieldset>
      </form>
      {state.status === "error" ? (
        <div
          className="notice notice-error"
          ref={feedback}
          role="alert"
          tabIndex={-1}
        >
          {state.message}
        </div>
      ) : null}
      {state.status === "success" ? (
        <div
          className="notice notice-success"
          ref={feedback}
          role="status"
          tabIndex={-1}
        >
          <p>{state.message}</p>
          <button
            className="primary-button"
            onClick={() => {
              router.replace("/scripture");
            }}
            type="button"
          >
            教会用画面へ
          </button>
        </div>
      ) : null}
    </>
  );
}
