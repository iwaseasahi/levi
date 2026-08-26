"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { PasswordInput } from "@/app/password-input";
import type { AdminLoginState } from "./auth-actions";

export function AdminLoginForm({
  action,
}: {
  action: (
    state: AdminLoginState,
    formData: FormData,
  ) => Promise<AdminLoginState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const feedback = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "error") feedback.current?.focus();
    if (state.status === "success") {
      router.replace(state.destination);
      router.refresh();
    }
  }, [router, state]);
  return (
    <form action={formAction} className="auth-form">
      <fieldset disabled={pending}>
        <legend className="sr-only">管理者ログイン</legend>
        <label htmlFor="admin-login-id">ログインID</label>
        <input
          autoComplete="username"
          id="admin-login-id"
          maxLength={100}
          name="loginId"
          required
        />
        <PasswordInput
          autoComplete="current-password"
          id="admin-login-password"
          label="パスワード"
          maxLength={256}
          name="password"
          required
        />
        <button className="primary-button" type="submit">
          {pending ? "ログイン中…" : "ログイン"}
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
