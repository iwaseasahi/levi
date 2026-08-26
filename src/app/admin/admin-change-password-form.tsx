"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { PasswordInput } from "@/app/password-input";
import type { AdminPasswordState } from "./auth-actions";

export function AdminChangePasswordForm({
  action,
}: {
  action: (
    state: AdminPasswordState,
    formData: FormData,
  ) => Promise<AdminPasswordState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const feedback = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "error") feedback.current?.focus();
    if (state.status === "success") {
      router.replace("/admin");
      router.refresh();
    }
  }, [router, state]);
  return (
    <form action={formAction} className="auth-form">
      <fieldset disabled={pending}>
        <legend className="sr-only">管理者パスワード変更</legend>
        <PasswordInput
          autoComplete="new-password"
          id="admin-new-password"
          label="新しいパスワード"
          minLength={12}
          maxLength={128}
          name="newPassword"
          required
        />
        <PasswordInput
          autoComplete="new-password"
          id="admin-password-confirmation"
          label="新しいパスワード（確認）"
          minLength={12}
          maxLength={128}
          name="confirmation"
          required
        />
        <button className="primary-button" type="submit">
          {pending ? "変更中…" : "パスワードを変更"}
        </button>
      </fieldset>
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
    </form>
  );
}
