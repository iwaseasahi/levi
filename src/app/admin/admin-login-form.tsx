"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordInput } from "@/app/password-input";
import { adminAuthClient } from "@/infrastructure/auth/admin-client";

export function AdminLoginForm() {
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function submit(formData: FormData) {
    setPending(true);
    setMessage(undefined);
    const result = await adminAuthClient.signIn.username({
      username: String(formData.get("loginId") ?? "")
        .trim()
        .toLowerCase(),
      password: String(formData.get("password") ?? ""),
      rememberMe: true,
    });
    if (result.error) {
      setPending(false);
      setMessage("ログインIDまたはパスワードを確認してください。");
      requestAnimationFrame(() => feedback.current?.focus());
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form action={submit} className="auth-form">
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
          maxLength={128}
          name="password"
          required
        />
        <button className="primary-button" type="submit">
          {pending ? "ログイン中…" : "ログイン"}
        </button>
      </fieldset>
      {message ? (
        <div
          className="notice notice-error"
          ref={feedback}
          role="alert"
          tabIndex={-1}
        >
          {message}
        </div>
      ) : null}
    </form>
  );
}
